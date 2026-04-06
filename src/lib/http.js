const { AppError } = require('./errors');

function setCommonHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader(
    'Access-Control-Allow-Methods',
    'GET, POST, PATCH, DELETE, OPTIONS'
  );
}

function sendJson(res, statusCode, payload) {
  if (res.writableEnded) {
    return;
  }

  setCommonHeaders(res);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
  });
  res.end(JSON.stringify(payload, null, 2));
}

function sendNoContent(res) {
  if (res.writableEnded) {
    return;
  }

  setCommonHeaders(res);
  res.writeHead(204);
  res.end();
}

async function parseJsonBody(req) {
  const chunks = [];

  for await (const chunk of req) {
    chunks.push(chunk);
  }

  if (chunks.length === 0) {
    return {};
  }

  const contentType = req.headers['content-type'] || '';
  if (!contentType.toLowerCase().includes('application/json')) {
    throw new AppError(
      415,
      'Unsupported media type. Use application/json for request bodies.'
    );
  }

  const rawBody = Buffer.concat(chunks).toString('utf8').trim();
  if (!rawBody) {
    return {};
  }

  try {
    return JSON.parse(rawBody);
  } catch (error) {
    throw new AppError(400, 'Request body contains invalid JSON.');
  }
}

function getBearerToken(req) {
  const authorization = req.headers.authorization || '';
  const [scheme, token] = authorization.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return null;
  }

  return token;
}

module.exports = {
  getBearerToken,
  parseJsonBody,
  sendJson,
  sendNoContent,
  setCommonHeaders,
};
