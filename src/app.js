const http = require('node:http');
const {
  PORT,
  DATABASE_URL,
  SEED_SAMPLE_DATA,
  GENERAL_RATE_LIMIT_MAX,
  GENERAL_RATE_LIMIT_WINDOW_MS,
  LOGIN_RATE_LIMIT_MAX,
  LOGIN_RATE_LIMIT_WINDOW_MS,
  PUBLIC_DIR,
} = require('./config');
const { createDatabase } = require('./database');
const { getOpenApiSpec } = require('./docs/openapi');
const { AppError, errorResponse } = require('./lib/errors');
const {
  getBearerToken,
  parseJsonBody,
  sendJson,
  sendNoContent,
  setCommonHeaders,
} = require('./lib/http');
const { createRateLimiter } = require('./lib/rate-limit');
const { createRouter } = require('./lib/router');
const { tryServeStaticFile } = require('./lib/static');
const {
  validateDashboardFilters,
  validateId,
  validateIncludeDeleted,
  validateLoginInput,
  validateRecordFilters,
  validateRecordPayload,
  validateUserPayload,
} = require('./lib/validators');
const { getAuthenticatedUser, login, logout } = require('./services/auth-service');
const { getOverview, getTrends } = require('./services/dashboard-service');
const {
  createRecord,
  getRecordById,
  getRecordByIdIncludingDeleted,
  listRecords,
  restoreRecord,
  softDeleteRecord,
  updateRecord,
} = require('./services/record-service');
const { createUser, getUserById, listUsers, updateUser } = require('./services/user-service');

function createApp(options = {}) {
  const router = createRouter();
  const generalLimiter = createRateLimiter({
    limit: options.generalRateLimitMax || GENERAL_RATE_LIMIT_MAX,
    windowMs: options.generalRateLimitWindowMs || GENERAL_RATE_LIMIT_WINDOW_MS,
    keyPrefix: 'general',
  });
  const loginLimiter = createRateLimiter({
    limit: options.loginRateLimitMax || LOGIN_RATE_LIMIT_MAX,
    windowMs: options.loginRateLimitWindowMs || LOGIN_RATE_LIMIT_WINDOW_MS,
    keyPrefix: 'login',
    message: 'Too many login attempts. Please try again later.',
  });

  let db = options.db || null;

  async function ensureDatabase() {
    if (!db) {
      db = await createDatabase({
        databaseUrl: options.databaseUrl || DATABASE_URL,
        pool: options.pool,
        seedSampleData: options.seedSampleData ?? SEED_SAMPLE_DATA,
      });
    }

    return db;
  }

  async function requireAuth(req) {
    const database = await ensureDatabase();
    const token = getBearerToken(req);
    const session = await getAuthenticatedUser(database, token);

    if (!session) {
      throw new AppError(401, 'Authentication is required for this endpoint.');
    }

    return session;
  }

  function requireRole(session, allowedRoles) {
    if (!allowedRoles.includes(session.user.role)) {
      throw new AppError(
        403,
        `Role ${session.user.role} is not allowed to perform this action.`
      );
    }
  }

  router.add('GET', '/', () => ({
    data: {
      name: 'Finance Records Service',
      version: '1.0.0',
      endpoints: {
        auth: ['/auth/login', '/auth/logout', '/auth/me'],
        users: ['/users', '/users/:id'],
        records: ['/records', '/records/:id', '/records/:id/restore'],
        dashboard: ['/dashboard/overview', '/dashboard/trends'],
        console: ['/app'],
        docs: ['/docs', '/openapi.json'],
      },
    },
  }));

  router.add('GET', '/health', () => ({
    data: {
      status: 'ok',
      timestamp: new Date().toISOString(),
    },
  }));

  router.add('GET', '/openapi.json', () => ({
    raw: true,
    body: getOpenApiSpec(),
  }));

  router.add('POST', '/auth/login', async ({ body }) => {
    const database = await ensureDatabase();
    const payload = validateLoginInput(body);

    return {
      data: await login(database, payload),
    };
  });

  router.add('POST', '/auth/logout', async ({ req }) => {
    const database = await ensureDatabase();
    const session = await requireAuth(req);
    await logout(database, session.token);
    return { statusCode: 204 };
  });

  router.add('GET', '/auth/me', async ({ req }) => ({
    data: (await requireAuth(req)).user,
  }));

  router.add('GET', '/users', async ({ req }) => {
    const database = await ensureDatabase();
    const session = await requireAuth(req);
    requireRole(session, ['admin']);

    return {
      data: await listUsers(database),
    };
  });

  router.add('POST', '/users', async ({ req, body }) => {
    const database = await ensureDatabase();
    const session = await requireAuth(req);
    requireRole(session, ['admin']);

    const payload = validateUserPayload(body);

    return {
      statusCode: 201,
      data: await createUser(database, payload),
    };
  });

  router.add('GET', '/users/:id', async ({ req, params }) => {
    const database = await ensureDatabase();
    const session = await requireAuth(req);
    requireRole(session, ['admin']);

    return {
      data: await getUserById(database, validateId(params.id, 'userId')),
    };
  });

  router.add('PATCH', '/users/:id', async ({ req, params, body }) => {
    const database = await ensureDatabase();
    const session = await requireAuth(req);
    requireRole(session, ['admin']);

    return {
      data: await updateUser(
        database,
        validateId(params.id, 'userId'),
        validateUserPayload(body, { partial: true })
      ),
    };
  });

  router.add('GET', '/records', async ({ req, url }) => {
    const database = await ensureDatabase();
    const session = await requireAuth(req);
    requireRole(session, ['analyst', 'admin']);

    const filters = validateRecordFilters(Object.fromEntries(url.searchParams.entries()));
    if (filters.includeDeleted && session.user.role !== 'admin') {
      throw new AppError(403, 'Only admins can view deleted records.');
    }

    const result = await listRecords(database, filters);
    return {
      data: result.items,
      meta: result.meta,
    };
  });

  router.add('GET', '/records/:id', async ({ req, params, url }) => {
    const database = await ensureDatabase();
    const session = await requireAuth(req);
    requireRole(session, ['analyst', 'admin']);

    const includeDeleted = validateIncludeDeleted(
      url.searchParams.get('includeDeleted') ?? undefined
    );

    if (includeDeleted && session.user.role !== 'admin') {
      throw new AppError(403, 'Only admins can view deleted records.');
    }

    return {
      data: includeDeleted
        ? await getRecordByIdIncludingDeleted(database, validateId(params.id, 'recordId'))
        : await getRecordById(database, validateId(params.id, 'recordId')),
    };
  });

  router.add('POST', '/records', async ({ req, body }) => {
    const database = await ensureDatabase();
    const session = await requireAuth(req);
    requireRole(session, ['admin']);

    return {
      statusCode: 201,
      data: await createRecord(
        database,
        validateRecordPayload(body),
        session.user.id
      ),
    };
  });

  router.add('PATCH', '/records/:id', async ({ req, params, body }) => {
    const database = await ensureDatabase();
    const session = await requireAuth(req);
    requireRole(session, ['admin']);

    return {
      data: await updateRecord(
        database,
        validateId(params.id, 'recordId'),
        validateRecordPayload(body, { partial: true }),
        session.user.id
      ),
    };
  });

  router.add('DELETE', '/records/:id', async ({ req, params }) => {
    const database = await ensureDatabase();
    const session = await requireAuth(req);
    requireRole(session, ['admin']);

    await softDeleteRecord(database, validateId(params.id, 'recordId'), session.user.id);
    return { statusCode: 204 };
  });

  router.add('POST', '/records/:id/restore', async ({ req, params }) => {
    const database = await ensureDatabase();
    const session = await requireAuth(req);
    requireRole(session, ['admin']);

    return {
      data: await restoreRecord(
        database,
        validateId(params.id, 'recordId'),
        session.user.id
      ),
    };
  });

  router.add('GET', '/dashboard/overview', async ({ req, url }) => {
    const database = await ensureDatabase();
    const session = await requireAuth(req);
    requireRole(session, ['viewer', 'analyst', 'admin']);

    return {
      data: await getOverview(
        database,
        validateDashboardFilters(Object.fromEntries(url.searchParams.entries()))
      ),
    };
  });

  router.add('GET', '/dashboard/trends', async ({ req, url }) => {
    const database = await ensureDatabase();
    const session = await requireAuth(req);
    requireRole(session, ['viewer', 'analyst', 'admin']);

    return {
      data: await getTrends(
        database,
        validateDashboardFilters(Object.fromEntries(url.searchParams.entries()))
      ),
    };
  });

  const server = http.createServer(async (req, res) => {
    setCommonHeaders(res);

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    try {
      const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

      const servedStatic = await tryServeStaticFile(req, res, url, PUBLIC_DIR);
      if (servedStatic) {
        return;
      }

      const route = router.match(req.method, url.pathname);
      if (!route) {
        throw new AppError(404, 'Route not found.');
      }

      if (url.pathname === '/auth/login' && req.method === 'POST') {
        loginLimiter.check(req);
      } else if (!url.pathname.startsWith('/assets/')) {
        generalLimiter.check(req);
      }

      const context = {
        req,
        res,
        url,
        params: route.params,
        body:
          req.method === 'POST' || req.method === 'PATCH'
            ? await parseJsonBody(req)
            : {},
      };

      const result = await route.handler(context);

      if (result?.statusCode === 204) {
        sendNoContent(res);
        return;
      }

      if (result?.raw) {
        sendJson(res, result?.statusCode || 200, result.body);
        return;
      }

      sendJson(res, result?.statusCode || 200, {
        data: result?.data ?? null,
        meta: result?.meta ?? null,
      });
    } catch (error) {
      const response = errorResponse(error);
      sendJson(res, response.statusCode, response.body);
    }
  });

  return {
    server,
    port: null,
    async start(port = PORT) {
      await ensureDatabase();
      await new Promise((resolve) => server.listen(port, resolve));
      this.port = server.address().port;
      return { port: this.port };
    },
    async close() {
      if (server.listening) {
        await new Promise((resolve, reject) => {
          server.close((error) => {
            if (error) {
              reject(error);
              return;
            }

            resolve();
          });
        });
      }

      if (db && typeof db.close === 'function') {
        await db.close();
      }
    },
  };
}

module.exports = {
  createApp,
};
