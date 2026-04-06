const path = require('node:path');

const ROOT_DIR = process.cwd();

function toBoolean(value, defaultValue = false) {
  if (value === undefined) {
    return defaultValue;
  }

  return String(value).toLowerCase() === 'true';
}

module.exports = {
  PORT: Number(process.env.PORT) || 3000,
  DATABASE_URL: process.env.DATABASE_URL || '',
  SESSION_TTL_HOURS: Number(process.env.SESSION_TTL_HOURS) || 24 * 7,
  PUBLIC_DIR: path.join(ROOT_DIR, 'public'),
  SEED_SAMPLE_DATA: toBoolean(process.env.SEED_SAMPLE_DATA, false),
  GENERAL_RATE_LIMIT_MAX: Number(process.env.GENERAL_RATE_LIMIT_MAX) || 200,
  GENERAL_RATE_LIMIT_WINDOW_MS:
    Number(process.env.GENERAL_RATE_LIMIT_WINDOW_MS) || 60 * 1000,
  LOGIN_RATE_LIMIT_MAX: Number(process.env.LOGIN_RATE_LIMIT_MAX) || 5,
  LOGIN_RATE_LIMIT_WINDOW_MS:
    Number(process.env.LOGIN_RATE_LIMIT_WINDOW_MS) || 10 * 60 * 1000,
};
