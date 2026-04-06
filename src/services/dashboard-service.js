const { listRecordsForSummary } = require('./record-service');

function getWeekPeriod(dateString) {
  const date = new Date(`${dateString}T00:00:00.000Z`);
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

function getTrendPeriod(dateString, groupBy) {
  if (groupBy === 'week') {
    return getWeekPeriod(dateString);
  }

  return String(dateString).slice(0, 7);
}

async function getOverview(db, filters) {
  const records = await listRecordsForSummary(db, filters);

  const totals = records.reduce(
    (accumulator, record) => {
      if (record.type === 'income') {
        accumulator.totalIncome += record.amount;
      } else {
        accumulator.totalExpenses += record.amount;
      }

      accumulator.totalRecords += 1;
      return accumulator;
    },
    {
      totalIncome: 0,
      totalExpenses: 0,
      totalRecords: 0,
    }
  );

  const categoryMap = new Map();
  for (const record of records) {
    const current = categoryMap.get(record.category) || {
      category: record.category,
      income: 0,
      expenses: 0,
      net: 0,
    };

    if (record.type === 'income') {
      current.income += record.amount;
      current.net += record.amount;
    } else {
      current.expenses += record.amount;
      current.net -= record.amount;
    }

    categoryMap.set(record.category, current);
  }

  const categoryBreakdown = Array.from(categoryMap.values()).sort((left, right) => {
    if (Math.abs(right.net) !== Math.abs(left.net)) {
      return Math.abs(right.net) - Math.abs(left.net);
    }

    return left.category.localeCompare(right.category);
  });

  const trendMap = new Map();
  for (const record of records) {
    const period = getTrendPeriod(record.entryDate, filters.groupBy);
    const current = trendMap.get(period) || {
      period,
      income: 0,
      expenses: 0,
      net: 0,
    };

    if (record.type === 'income') {
      current.income += record.amount;
      current.net += record.amount;
    } else {
      current.expenses += record.amount;
      current.net -= record.amount;
    }

    trendMap.set(period, current);
  }

  const trends = Array.from(trendMap.values()).sort((left, right) =>
    left.period.localeCompare(right.period)
  );

  return {
    totals: {
      totalIncome: Number(totals.totalIncome.toFixed(2)),
      totalExpenses: Number(totals.totalExpenses.toFixed(2)),
      netBalance: Number((totals.totalIncome - totals.totalExpenses).toFixed(2)),
      totalRecords: totals.totalRecords,
    },
    categoryBreakdown: categoryBreakdown.map((entry) => ({
      ...entry,
      income: Number(entry.income.toFixed(2)),
      expenses: Number(entry.expenses.toFixed(2)),
      net: Number(entry.net.toFixed(2)),
    })),
    recentActivity: records.slice(0, filters.recentLimit),
    trends: trends.map((entry) => ({
      ...entry,
      income: Number(entry.income.toFixed(2)),
      expenses: Number(entry.expenses.toFixed(2)),
      net: Number(entry.net.toFixed(2)),
    })),
  };
}

async function getTrends(db, filters) {
  const overview = await getOverview(db, filters);
  return overview.trends;
}

module.exports = {
  getOverview,
  getTrends,
};
