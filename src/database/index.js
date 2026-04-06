const { Pool } = require('pg');
const { DATABASE_URL, SEED_SAMPLE_DATA } = require('../config');
const { migrate } = require('./schema');
const { seedDatabase } = require('./seed');

function isLocalConnectionString(connectionString) {
  return (
    connectionString.includes('localhost') ||
    connectionString.includes('127.0.0.1') ||
    connectionString.includes('@postgres:')
  );
}

function createPool(connectionString) {
  const normalizedUrl = new URL(connectionString);
  normalizedUrl.searchParams.delete('sslmode');

  return new Pool({
    connectionString: normalizedUrl.toString(),
    ssl: isLocalConnectionString(connectionString)
      ? false
      : {
          rejectUnauthorized: false,
        },
  });
}

async function createDatabase(options = {}) {
  const {
    databaseUrl = DATABASE_URL,
    pool: existingPool,
    seedSampleData = SEED_SAMPLE_DATA,
  } = options;

  if (!existingPool && !databaseUrl) {
    throw new Error('DATABASE_URL is required to start the service.');
  }

  const pool = existingPool || createPool(databaseUrl);
  await migrate(pool);

  if (seedSampleData) {
    await seedDatabase(pool);
  }

  return {
    async query(text, params = []) {
      return pool.query(text, params);
    },
    async close() {
      if (typeof pool.end === 'function') {
        await pool.end();
      }
    },
  };
}

module.exports = {
  createDatabase,
};
