const { AppError } = require('../lib/errors');
const { toDateOnly, toIsoTimestamp } = require('../lib/serializers');

function mapRecord(row) {
  return {
    id: Number(row.id),
    amount: Number(Number(row.amount).toFixed(2)),
    type: row.type,
    category: row.category,
    entryDate: toDateOnly(row.entry_date),
    notes: row.notes,
    createdBy: row.created_by === null ? null : Number(row.created_by),
    updatedBy: row.updated_by === null ? null : Number(row.updated_by),
    createdAt: toIsoTimestamp(row.created_at),
    updatedAt: toIsoTimestamp(row.updated_at),
    deletedAt: toIsoTimestamp(row.deleted_at),
    deletedBy: row.deleted_by === null ? null : Number(row.deleted_by),
    isDeleted: Boolean(row.deleted_at),
  };
}

function buildRecordWhereClause(filters = {}, alias = '', startIndex = 1) {
  const prefix = alias ? `${alias}.` : '';
  const conditions = [];
  const params = [];
  let index = startIndex;

  if (!filters.includeDeleted) {
    conditions.push(`${prefix}deleted_at IS NULL`);
  }

  if (filters.type) {
    params.push(filters.type);
    conditions.push(`${prefix}type = $${index}`);
    index += 1;
  }

  if (filters.category) {
    params.push(filters.category);
    conditions.push(`${prefix}category = $${index}`);
    index += 1;
  }

  if (filters.from) {
    params.push(filters.from);
    conditions.push(`${prefix}entry_date >= $${index}`);
    index += 1;
  }

  if (filters.to) {
    params.push(filters.to);
    conditions.push(`${prefix}entry_date <= $${index}`);
    index += 1;
  }

  if (filters.search) {
    const term = `%${filters.search.toLowerCase()}%`;
    params.push(term, term);
    conditions.push(
      `(LOWER(${prefix}category) LIKE $${index} OR LOWER(COALESCE(${prefix}notes, '')) LIKE $${
        index + 1
      })`
    );
    index += 2;
  }

  return {
    sql: conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '',
    params,
    nextIndex: index,
  };
}

async function getRecordById(db, recordId) {
  const result = await db.query('SELECT * FROM financial_records WHERE id = $1', [recordId]);
  const row = result.rows[0];

  if (!row || row.deleted_at) {
    throw new AppError(404, 'Financial record not found.');
  }

  return mapRecord(row);
}

async function getRecordByIdIncludingDeleted(db, recordId) {
  const result = await db.query('SELECT * FROM financial_records WHERE id = $1', [recordId]);

  if (result.rowCount === 0) {
    throw new AppError(404, 'Financial record not found.');
  }

  return mapRecord(result.rows[0]);
}

async function listRecords(db, filters) {
  const where = buildRecordWhereClause(filters);
  const totalResult = await db.query(
    `SELECT COUNT(*) AS count FROM financial_records ${where.sql}`,
    where.params
  );

  const offset = (filters.page - 1) * filters.pageSize;
  const listResult = await db.query(
    `
      SELECT *
      FROM financial_records
      ${where.sql}
      ORDER BY entry_date DESC, id DESC
      LIMIT $${where.nextIndex} OFFSET $${where.nextIndex + 1}
    `,
    [...where.params, filters.pageSize, offset]
  );

  const totalItems = Number(totalResult.rows[0].count);

  return {
    items: listResult.rows.map(mapRecord),
    meta: {
      page: filters.page,
      pageSize: filters.pageSize,
      totalItems,
      totalPages: Math.max(1, Math.ceil(totalItems / filters.pageSize)),
    },
  };
}

async function listRecordsForSummary(db, filters) {
  const where = buildRecordWhereClause(filters);
  const result = await db.query(
    `
      SELECT *
      FROM financial_records
      ${where.sql}
      ORDER BY entry_date DESC, id DESC
    `,
    where.params
  );

  return result.rows.map(mapRecord);
}

async function createRecord(db, payload, actorId) {
  const now = new Date().toISOString();
  const result = await db.query(
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
      RETURNING *
    `,
    [
      payload.amount,
      payload.type,
      payload.category,
      payload.entryDate,
      payload.notes,
      actorId,
      actorId,
      now,
      now,
    ]
  );

  return mapRecord(result.rows[0]);
}

async function updateRecord(db, recordId, payload, actorId) {
  await getRecordById(db, recordId);

  const updates = [];
  const params = [];

  if (payload.amount !== undefined) {
    params.push(payload.amount);
    updates.push(`amount = $${params.length}`);
  }

  if (payload.type !== undefined) {
    params.push(payload.type);
    updates.push(`type = $${params.length}`);
  }

  if (payload.category !== undefined) {
    params.push(payload.category);
    updates.push(`category = $${params.length}`);
  }

  if (payload.entryDate !== undefined) {
    params.push(payload.entryDate);
    updates.push(`entry_date = $${params.length}`);
  }

  if (payload.notes !== undefined) {
    params.push(payload.notes);
    updates.push(`notes = $${params.length}`);
  }

  if (updates.length === 0) {
    throw new AppError(400, 'At least one record field must be provided.');
  }

  params.push(actorId);
  updates.push(`updated_by = $${params.length}`);
  params.push(new Date().toISOString());
  updates.push(`updated_at = $${params.length}`);
  params.push(recordId);

  const result = await db.query(
    `
      UPDATE financial_records
      SET ${updates.join(', ')}
      WHERE id = $${params.length}
      RETURNING *
    `,
    params
  );

  return mapRecord(result.rows[0]);
}

async function softDeleteRecord(db, recordId, actorId) {
  const existing = await getRecordByIdIncludingDeleted(db, recordId);
  if (existing.isDeleted) {
    throw new AppError(409, 'Financial record is already deleted.');
  }

  await db.query(
    `
      UPDATE financial_records
      SET deleted_at = $1, deleted_by = $2, updated_by = $3, updated_at = $4
      WHERE id = $5
    `,
    [new Date().toISOString(), actorId, actorId, new Date().toISOString(), recordId]
  );
}

async function restoreRecord(db, recordId, actorId) {
  const existing = await getRecordByIdIncludingDeleted(db, recordId);
  if (!existing.isDeleted) {
    throw new AppError(409, 'Financial record is not deleted.');
  }

  const result = await db.query(
    `
      UPDATE financial_records
      SET deleted_at = NULL, deleted_by = NULL, updated_by = $1, updated_at = $2
      WHERE id = $3
      RETURNING *
    `,
    [actorId, new Date().toISOString(), recordId]
  );

  return mapRecord(result.rows[0]);
}

module.exports = {
  buildRecordWhereClause,
  createRecord,
  getRecordById,
  getRecordByIdIncludingDeleted,
  listRecords,
  listRecordsForSummary,
  mapRecord,
  restoreRecord,
  softDeleteRecord,
  updateRecord,
};
