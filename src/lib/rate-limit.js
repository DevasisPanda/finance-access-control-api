const { AppError } = require('./errors');

function getClientKey(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    return String(forwarded).split(',')[0].trim();
  }

  return req.socket?.remoteAddress || 'unknown';
}

function createRateLimiter(options) {
  const hits = new Map();
  const {
    limit,
    windowMs,
    message = 'Too many requests. Please try again later.',
    keyPrefix = 'global',
  } = options;

  function check(req) {
    const now = Date.now();
    const key = `${keyPrefix}:${getClientKey(req)}`;
    const current = hits.get(key);

    if (!current || current.resetAt <= now) {
      hits.set(key, {
        count: 1,
        resetAt: now + windowMs,
      });
      return;
    }

    current.count += 1;
    if (current.count > limit) {
      throw new AppError(429, message, {
        retryAfterSeconds: Math.ceil((current.resetAt - now) / 1000),
        limit,
        windowMs,
      });
    }
  }

  return {
    check,
  };
}

module.exports = {
  createRateLimiter,
};
