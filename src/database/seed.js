const { hashPassword } = require('../lib/security');

async function seedDatabase(db) {
  const existingUsers = await db.query('SELECT COUNT(*) AS count FROM users');
  if (Number(existingUsers.rows[0].count) > 0) {
    return;
  }

  const now = new Date().toISOString();

  const sampleUsers = [
    {
      name: 'Operations Admin',
      email: 'admin@finance.local',
      password: 'Admin@123',
      role: 'admin',
      status: 'active',
    },
    {
      name: 'Anika Analyst',
      email: 'analyst@finance.local',
      password: 'Analyst@123',
      role: 'analyst',
      status: 'active',
    },
    {
      name: 'Victor Viewer',
      email: 'viewer@finance.local',
      password: 'Viewer@123',
      role: 'viewer',
      status: 'active',
    },
  ];

  for (const user of sampleUsers) {
    await db.query(
      `
        INSERT INTO users (name, email, password_hash, role, status, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `,
      [
        user.name,
        user.email,
        hashPassword(user.password),
        user.role,
        user.status,
        now,
        now,
      ]
    );
  }

  const adminUser = await db.query('SELECT id FROM users WHERE email = $1', [
    'admin@finance.local',
  ]);

  const sampleRecords = [
    [5500, 'income', 'Salary', '2026-01-28', 'January payroll'],
    [850, 'expense', 'Rent', '2026-01-29', 'Office rent'],
    [420, 'expense', 'Software', '2026-02-03', 'Analytics subscription'],
    [6200, 'income', 'Consulting', '2026-02-10', 'Client invoice'],
    [1450, 'expense', 'Marketing', '2026-02-18', 'Ad campaign'],
    [5800, 'income', 'Salary', '2026-03-01', 'February payroll'],
    [640, 'expense', 'Utilities', '2026-03-02', 'Electricity and internet'],
    [1250, 'expense', 'Travel', '2026-03-12', 'Investor meeting'],
    [2700, 'income', 'Investments', '2026-03-15', 'Dividend payout'],
    [390, 'expense', 'Software', '2026-03-20', 'Team tools'],
  ];

  for (const [amount, type, category, entryDate, notes] of sampleRecords) {
    await db.query(
      `
        INSERT INTO financial_records (
          amount,
          type,
          category,
          entry_date,
          notes,
          created_by,
          updated_by,
          created_at,
          updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `,
      [
        amount,
        type,
        category,
        entryDate,
        notes,
        adminUser.rows[0].id,
        adminUser.rows[0].id,
        now,
        now,
      ]
    );
  }
}

module.exports = {
  seedDatabase,
};
