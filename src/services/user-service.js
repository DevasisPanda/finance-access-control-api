const { AppError } = require('../lib/errors');
const { hashPassword } = require('../lib/security');
const { toIsoTimestamp } = require('../lib/serializers');

function mapUser(row) {
  if (!row) {
    return null;
  }

  return {
    id: Number(row.id),
    name: row.name,
    email: row.email,
    role: row.role,
    status: row.status,
    createdAt: toIsoTimestamp(row.created_at),
    updatedAt: toIsoTimestamp(row.updated_at),
  };
}

async function getUserById(db, userId) {
  const result = await db.query(
    `
      SELECT id, name, email, role, status, created_at, updated_at
      FROM users
      WHERE id = $1
    `,
    [userId]
  );

  if (result.rowCount === 0) {
    throw new AppError(404, 'User not found.');
  }

  return mapUser(result.rows[0]);
}

async function listUsers(db) {
  const result = await db.query(
    `
      SELECT id, name, email, role, status, created_at, updated_at
      FROM users
      ORDER BY id ASC
    `
  );

  return result.rows.map(mapUser);
}

async function createUser(db, payload) {
  const now = new Date().toISOString();

  try {
    const result = await db.query(
      `
        INSERT INTO users (name, email, password_hash, role, status, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id, name, email, role, status, created_at, updated_at
      `,
      [
        payload.name,
        payload.email,
        hashPassword(payload.password),
        payload.role,
        payload.status,
        now,
        now,
      ]
    );

    return mapUser(result.rows[0]);
  } catch (error) {
    if (error && error.code === '23505') {
      throw new AppError(409, 'A user with this email already exists.');
    }

    throw error;
  }
}

async function updateUser(db, userId, payload) {
  await getUserById(db, userId);

  const updates = [];
  const params = [];

  if (payload.name !== undefined) {
    params.push(payload.name);
    updates.push(`name = $${params.length}`);
  }

  if (payload.email !== undefined) {
    params.push(payload.email);
    updates.push(`email = $${params.length}`);
  }

  if (payload.password !== undefined) {
    params.push(hashPassword(payload.password));
    updates.push(`password_hash = $${params.length}`);
  }

  if (payload.role !== undefined) {
    params.push(payload.role);
    updates.push(`role = $${params.length}`);
  }

  if (payload.status !== undefined) {
    params.push(payload.status);
    updates.push(`status = $${params.length}`);
  }

  if (updates.length === 0) {
    throw new AppError(400, 'At least one user field must be provided.');
  }

  params.push(new Date().toISOString());
  updates.push(`updated_at = $${params.length}`);
  params.push(userId);

  try {
    const result = await db.query(
      `
        UPDATE users
        SET ${updates.join(', ')}
        WHERE id = $${params.length}
        RETURNING id, name, email, role, status, created_at, updated_at
      `,
      params
    );

    return mapUser(result.rows[0]);
  } catch (error) {
    if (error && error.code === '23505') {
      throw new AppError(409, 'A user with this email already exists.');
    }

    throw error;
  }
}

module.exports = {
  createUser,
  getUserById,
  listUsers,
  mapUser,
  updateUser,
};
