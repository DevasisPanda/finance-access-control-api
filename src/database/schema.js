async function migrate(db) {
  await db.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('viewer', 'analyst', 'admin')),
      status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
      created_at TIMESTAMPTZ NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL
    );
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL
    );
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS financial_records (
      id SERIAL PRIMARY KEY,
      amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
      type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
      category TEXT NOT NULL,
      entry_date DATE NOT NULL,
      notes TEXT NOT NULL DEFAULT '',
      created_by INTEGER NOT NULL REFERENCES users(id),
      updated_by INTEGER REFERENCES users(id),
      deleted_by INTEGER REFERENCES users(id),
      deleted_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL
    );
  `);

  await db.query('CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);');
  await db.query(
    'CREATE INDEX IF NOT EXISTS idx_records_entry_date ON financial_records(entry_date);'
  );
  await db.query(
    'CREATE INDEX IF NOT EXISTS idx_records_type ON financial_records(type);'
  );
  await db.query(
    'CREATE INDEX IF NOT EXISTS idx_records_category ON financial_records(category);'
  );
  await db.query(
    'CREATE INDEX IF NOT EXISTS idx_records_deleted_at ON financial_records(deleted_at);'
  );
}

module.exports = {
  migrate,
};
