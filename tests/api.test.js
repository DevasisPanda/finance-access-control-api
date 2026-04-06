const test = require('node:test');
const assert = require('node:assert/strict');
const { createApp } = require('../src/app');
const { createTestPool } = require('../src/database/testing');

async function withTestServer(run, appOptions = {}) {
  const pool = createTestPool();
  const app = createApp({ pool, seedSampleData: true, ...appOptions });
  await app.start(0);
  const baseUrl = `http://127.0.0.1:${app.port}`;

  try {
    await run({ baseUrl });
  } finally {
    await app.close();
  }
}

async function request(baseUrl, pathname, options = {}) {
  const headers = {};
  if (options.token) {
    headers.Authorization = `Bearer ${options.token}`;
  }
  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(`${baseUrl}${pathname}`, {
    method: options.method || 'GET',
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  const text = await response.text();
  return {
    status: response.status,
    body: text ? JSON.parse(text) : null,
  };
}

async function loginAs(baseUrl, email, password) {
  const response = await request(baseUrl, '/auth/login', {
    method: 'POST',
    body: { email, password },
  });

  assert.equal(response.status, 200);
  return response.body.data.token;
}

test('login returns a token and the authenticated user profile', async () => {
  await withTestServer(async ({ baseUrl }) => {
    const response = await request(baseUrl, '/auth/login', {
      method: 'POST',
      body: {
        email: 'admin@finance.local',
        password: 'Admin@123',
      },
    });

    assert.equal(response.status, 200);
    assert.equal(response.body.data.user.role, 'admin');
    assert.ok(response.body.data.token);
  });
});

test('frontend and docs endpoints are served', async () => {
  await withTestServer(async ({ baseUrl }) => {
    const appResponse = await fetch(`${baseUrl}/app`);
    assert.equal(appResponse.status, 200);
    assert.match(await appResponse.text(), /Finance Operations Console/);

    const docsResponse = await fetch(`${baseUrl}/docs`);
    assert.equal(docsResponse.status, 200);
    assert.match(await docsResponse.text(), /Finance Records API Reference/);

    const openApiResponse = await fetch(`${baseUrl}/openapi.json`);
    assert.equal(openApiResponse.status, 200);
    const openApiBody = await openApiResponse.json();
    assert.equal(openApiBody.openapi, '3.0.3');
  });
});

test('viewer can access dashboard data but is blocked from record listing', async () => {
  await withTestServer(async ({ baseUrl }) => {
    const token = await loginAs(baseUrl, 'viewer@finance.local', 'Viewer@123');

    const dashboardResponse = await request(baseUrl, '/dashboard/overview', {
      token,
    });
    assert.equal(dashboardResponse.status, 200);
    assert.ok(dashboardResponse.body.data.totals.netBalance);

    const recordResponse = await request(baseUrl, '/records', {
      token,
    });
    assert.equal(recordResponse.status, 403);
  });
});

test('analyst can read filtered records', async () => {
  await withTestServer(async ({ baseUrl }) => {
    const token = await loginAs(baseUrl, 'analyst@finance.local', 'Analyst@123');

    const response = await request(
      baseUrl,
      '/records?type=income&page=1&pageSize=2',
      {
        token,
      }
    );

    assert.equal(response.status, 200);
    assert.equal(response.body.meta.pageSize, 2);
    assert.equal(response.body.data.length, 2);
    assert.ok(response.body.data.every((record) => record.type === 'income'));
  });
});

test('admin can create a record and invalid payloads are rejected', async () => {
  await withTestServer(async ({ baseUrl }) => {
    const token = await loginAs(baseUrl, 'admin@finance.local', 'Admin@123');

    const invalidResponse = await request(baseUrl, '/records', {
      method: 'POST',
      token,
      body: {
        amount: -50,
        type: 'expense',
        category: 'Travel',
        entryDate: '2026-03-30',
      },
    });

    assert.equal(invalidResponse.status, 400);

    const createResponse = await request(baseUrl, '/records', {
      method: 'POST',
      token,
      body: {
        amount: 999.5,
        type: 'income',
        category: 'Bonus',
        entryDate: '2026-03-30',
        notes: 'Quarter-end performance bonus',
      },
    });

    assert.equal(createResponse.status, 201);
    assert.equal(createResponse.body.data.category, 'Bonus');

    const overviewResponse = await request(
      baseUrl,
      '/dashboard/overview?from=2026-03-01&to=2026-03-31',
      {
        token,
      }
    );

    assert.equal(overviewResponse.status, 200);
    assert.equal(overviewResponse.body.data.totals.totalIncome, 9499.5);
  });
});

test('admin can manage users, deactivate them, and inactive users cannot log in', async () => {
  await withTestServer(async ({ baseUrl }) => {
    const token = await loginAs(baseUrl, 'admin@finance.local', 'Admin@123');

    const createResponse = await request(baseUrl, '/users', {
      method: 'POST',
      token,
      body: {
        name: 'Priya Ops',
        email: 'priya@example.com',
        password: 'StrongPass@123',
        role: 'analyst',
        status: 'active',
      },
    });

    assert.equal(createResponse.status, 201);
    const userId = createResponse.body.data.id;

    const getResponse = await request(baseUrl, `/users/${userId}`, { token });
    assert.equal(getResponse.status, 200);
    assert.equal(getResponse.body.data.email, 'priya@example.com');

    const duplicateResponse = await request(baseUrl, '/users', {
      method: 'POST',
      token,
      body: {
        name: 'Priya Again',
        email: 'priya@example.com',
        password: 'StrongPass@123',
        role: 'viewer',
        status: 'active',
      },
    });

    assert.equal(duplicateResponse.status, 409);

    const deactivateResponse = await request(baseUrl, `/users/${userId}`, {
      method: 'PATCH',
      token,
      body: {
        status: 'inactive',
      },
    });

    assert.equal(deactivateResponse.status, 200);
    assert.equal(deactivateResponse.body.data.status, 'inactive');

    const loginResponse = await request(baseUrl, '/auth/login', {
      method: 'POST',
      body: {
        email: 'priya@example.com',
        password: 'StrongPass@123',
      },
    });

    assert.equal(loginResponse.status, 403);
  });
});

test('auth and validation failures return appropriate error codes', async () => {
  await withTestServer(async ({ baseUrl }) => {
    const unauthenticatedResponse = await request(baseUrl, '/dashboard/overview');
    assert.equal(unauthenticatedResponse.status, 401);

    const invalidJsonResponse = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: '{"email":"admin@finance.local"',
    });
    assert.equal(invalidJsonResponse.status, 400);

    const unsupportedMediaTypeResponse = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain',
      },
      body: 'email=admin@finance.local',
    });
    assert.equal(unsupportedMediaTypeResponse.status, 415);

    const token = await loginAs(baseUrl, 'admin@finance.local', 'Admin@123');

    const invalidFilterResponse = await request(
      baseUrl,
      '/records?from=2026-03-31&to=2026-03-01',
      { token }
    );
    assert.equal(invalidFilterResponse.status, 400);

    const invalidIdResponse = await request(baseUrl, '/records/0', { token });
    assert.equal(invalidIdResponse.status, 400);

    const invalidIncludeDeletedResponse = await request(
      baseUrl,
      '/records?includeDeleted=maybe',
      { token }
    );
    assert.equal(invalidIncludeDeletedResponse.status, 400);

    const invalidDashboardGroupByResponse = await request(
      baseUrl,
      '/dashboard/trends?groupBy=year',
      { token }
    );
    assert.equal(invalidDashboardGroupByResponse.status, 400);

    const invalidPageSizeResponse = await request(
      baseUrl,
      '/records?pageSize=101',
      { token }
    );
    assert.equal(invalidPageSizeResponse.status, 400);
  });
});

test('role restrictions, logout, delete flow, and weekly trends behave correctly', async () => {
  await withTestServer(async ({ baseUrl }) => {
    const analystToken = await loginAs(
      baseUrl,
      'analyst@finance.local',
      'Analyst@123'
    );

    const forbiddenCreateResponse = await request(baseUrl, '/records', {
      method: 'POST',
      token: analystToken,
      body: {
        amount: 50,
        type: 'expense',
        category: 'Snacks',
        entryDate: '2026-03-21',
      },
    });
    assert.equal(forbiddenCreateResponse.status, 403);

    const viewerToken = await loginAs(baseUrl, 'viewer@finance.local', 'Viewer@123');
    const weeklyTrendsResponse = await request(
      baseUrl,
      '/dashboard/trends?groupBy=week&from=2026-03-01&to=2026-03-31',
      { token: viewerToken }
    );
    assert.equal(weeklyTrendsResponse.status, 200);
    assert.ok(Array.isArray(weeklyTrendsResponse.body.data));
    assert.ok(
      weeklyTrendsResponse.body.data.every((entry) =>
        Object.hasOwn(entry, 'period')
      )
    );

    const adminToken = await loginAs(baseUrl, 'admin@finance.local', 'Admin@123');
    const createResponse = await request(baseUrl, '/records', {
      method: 'POST',
      token: adminToken,
      body: {
        amount: 125,
        type: 'expense',
        category: 'Meals',
        entryDate: '2026-03-22',
        notes: 'Team lunch',
      },
    });
    assert.equal(createResponse.status, 201);

    const recordId = createResponse.body.data.id;

    const deleteResponse = await request(baseUrl, `/records/${recordId}`, {
      method: 'DELETE',
      token: adminToken,
    });
    assert.equal(deleteResponse.status, 204);

    const missingRecordResponse = await request(baseUrl, `/records/${recordId}`, {
      token: adminToken,
    });
    assert.equal(missingRecordResponse.status, 404);

    const deletedRecordResponse = await request(
      baseUrl,
      `/records/${recordId}?includeDeleted=true`,
      {
        token: adminToken,
      }
    );
    assert.equal(deletedRecordResponse.status, 200);
    assert.equal(deletedRecordResponse.body.data.isDeleted, true);

    const analystDeletedRecordResponse = await request(
      baseUrl,
      `/records/${recordId}?includeDeleted=true`,
      {
        token: analystToken,
      }
    );
    assert.equal(analystDeletedRecordResponse.status, 403);

    const restoreResponse = await request(baseUrl, `/records/${recordId}/restore`, {
      method: 'POST',
      token: adminToken,
      body: {},
    });
    assert.equal(restoreResponse.status, 200);
    assert.equal(restoreResponse.body.data.isDeleted, false);

    const restoredRecordResponse = await request(baseUrl, `/records/${recordId}`, {
      token: adminToken,
    });
    assert.equal(restoredRecordResponse.status, 200);

    const logoutResponse = await request(baseUrl, '/auth/logout', {
      method: 'POST',
      token: adminToken,
    });
    assert.equal(logoutResponse.status, 204);

    const meAfterLogoutResponse = await request(baseUrl, '/auth/me', {
      token: adminToken,
    });
    assert.equal(meAfterLogoutResponse.status, 401);
  });
});

test('login attempts are rate limited', async () => {
  await withTestServer(
    async ({ baseUrl }) => {
      for (let index = 0; index < 2; index += 1) {
        const response = await request(baseUrl, '/auth/login', {
          method: 'POST',
          body: {
            email: 'admin@finance.local',
            password: 'wrong-password',
          },
        });

        assert.equal(response.status, 401);
      }

      const limitedResponse = await request(baseUrl, '/auth/login', {
        method: 'POST',
        body: {
          email: 'admin@finance.local',
          password: 'wrong-password',
        },
      });

      assert.equal(limitedResponse.status, 429);
    },
    {
      loginRateLimitMax: 2,
      loginRateLimitWindowMs: 60_000,
    }
  );
});

test('conflicting delete and restore actions return conflict responses', async () => {
  await withTestServer(async ({ baseUrl }) => {
    const adminToken = await loginAs(baseUrl, 'admin@finance.local', 'Admin@123');

    const createResponse = await request(baseUrl, '/records', {
      method: 'POST',
      token: adminToken,
      body: {
        amount: 220,
        type: 'expense',
        category: 'Travel',
        entryDate: '2026-03-25',
        notes: 'Cab fare',
      },
    });
    assert.equal(createResponse.status, 201);

    const recordId = createResponse.body.data.id;

    const restoreActiveResponse = await request(baseUrl, `/records/${recordId}/restore`, {
      method: 'POST',
      token: adminToken,
      body: {},
    });
    assert.equal(restoreActiveResponse.status, 409);

    const deleteResponse = await request(baseUrl, `/records/${recordId}`, {
      method: 'DELETE',
      token: adminToken,
    });
    assert.equal(deleteResponse.status, 204);

    const deleteAgainResponse = await request(baseUrl, `/records/${recordId}`, {
      method: 'DELETE',
      token: adminToken,
    });
    assert.equal(deleteAgainResponse.status, 409);
  });
});

test('empty partial updates and invalid role payloads are rejected', async () => {
  await withTestServer(async ({ baseUrl }) => {
    const adminToken = await loginAs(baseUrl, 'admin@finance.local', 'Admin@123');

    const invalidUserRoleResponse = await request(baseUrl, '/users', {
      method: 'POST',
      token: adminToken,
      body: {
        name: 'Bad Role',
        email: 'badrole@example.com',
        password: 'StrongPass@123',
        role: 'owner',
        status: 'active',
      },
    });
    assert.equal(invalidUserRoleResponse.status, 400);

    const emptyUserPatchResponse = await request(baseUrl, '/users/1', {
      method: 'PATCH',
      token: adminToken,
      body: {},
    });
    assert.equal(emptyUserPatchResponse.status, 400);

    const emptyRecordPatchResponse = await request(baseUrl, '/records/1', {
      method: 'PATCH',
      token: adminToken,
      body: {},
    });
    assert.equal(emptyRecordPatchResponse.status, 400);
  });
});

test('general api traffic can also be rate limited', async () => {
  await withTestServer(
    async ({ baseUrl }) => {
      const adminToken = await loginAs(baseUrl, 'admin@finance.local', 'Admin@123');

      const firstResponse = await request(baseUrl, '/auth/me', { token: adminToken });
      assert.equal(firstResponse.status, 200);

      const secondResponse = await request(baseUrl, '/dashboard/overview', {
        token: adminToken,
      });
      assert.equal(secondResponse.status, 429);
    },
    {
      generalRateLimitMax: 1,
      generalRateLimitWindowMs: 60_000,
      loginRateLimitMax: 10,
    }
  );
});
