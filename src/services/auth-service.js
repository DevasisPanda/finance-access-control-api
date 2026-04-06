const { SESSION_TTL_HOURS } = require('../config');
const { AppError } = require('../lib/errors');
const { generateToken, verifyPassword } = require('../lib/security');
const { toIsoTimestamp } = require('../lib/serializers');
const { mapUser } = require('./user-service');

async function login(db, payload) {
  const result = await db.query('SELECT * FROM users WHERE email = $1', [payload.email]);
  const user = result.rows[0];

  if (!user || !verifyPassword(payload.password, user.password_hash)) {
    throw new AppError(401, 'Invalid email or password.');
  }

  if (user.status !== 'active') {
    throw new AppError(403, 'This account is inactive.');
  }

  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_TTL_HOURS * 60 * 60 * 1000);
  const token = generateToken();

  await db.query(
    `
      INSERT INTO sessions (token, user_id, created_at, expires_at)
      VALUES ($1, $2, $3, $4)
    `,
    [token, user.id, now.toISOString(), expiresAt.toISOString()]
  );

  return {
    token,
    expiresAt: expiresAt.toISOString(),
    user: mapUser(user),
  };
}

async function getAuthenticatedUser(db, token) {
  if (!token) {
    return null;
  }

  const result = await db.query(
    `
      SELECT
        s.token,
        s.expires_at,
        u.id,
        u.name,
        u.email,
        u.role,
        u.status,
        u.created_at,
        u.updated_at
      FROM sessions s
      JOIN users u ON u.id = s.user_id
      WHERE s.token = $1 AND s.expires_at > $2
    `,
    [token, new Date().toISOString()]
  );

  const row = result.rows[0];
  if (!row || row.status !== 'active') {
    return null;
  }

  return {
    token: row.token,
    expiresAt: toIsoTimestamp(row.expires_at),
    user: mapUser(row),
  };
}

async function logout(db, token) {
  if (!token) {
    return;
  }

  await db.query('DELETE FROM sessions WHERE token = $1', [token]);
}

module.exports = {
  getAuthenticatedUser,
  login,
  logout,
};
