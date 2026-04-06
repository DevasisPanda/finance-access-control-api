const { newDb } = require('pg-mem');

function createTestPool() {
  const memoryDb = newDb({
    autoCreateForeignKeyIndices: true,
  });
  const adapter = memoryDb.adapters.createPg();

  return new adapter.Pool();
}

module.exports = {
  createTestPool,
};
