const { AppError } = require('./errors');

const USER_ROLES = ['viewer', 'analyst', 'admin'];
const USER_STATUSES = ['active', 'inactive'];
const RECORD_TYPES = ['income', 'expense'];

function ensureObject(value, message = 'Request body must be a JSON object.') {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new AppError(400, message);
  }
}

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : value;
}

function ensureRequiredString(value, fieldName) {
  const normalized = normalizeString(value);
  if (!normalized) {
    throw new AppError(400, `${fieldName} is required.`);
  }

  return normalized;
}

function ensureOptionalString(value, fieldName, maxLength = 500) {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return '';
  }

  if (typeof value !== 'string') {
    throw new AppError(400, `${fieldName} must be a string.`);
  }

  const normalized = value.trim();
  if (normalized.length > maxLength) {
    throw new AppError(
      400,
      `${fieldName} must be at most ${maxLength} characters long.`
    );
  }

  return normalized;
}

function ensureEmail(value) {
  const email = ensureRequiredString(value, 'email').toLowerCase();
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!emailPattern.test(email)) {
    throw new AppError(400, 'email must be a valid email address.');
  }

  return email;
}

function ensureEnum(value, fieldName, allowedValues) {
  const normalized = ensureRequiredString(value, fieldName).toLowerCase();
  if (!allowedValues.includes(normalized)) {
    throw new AppError(
      400,
      `${fieldName} must be one of: ${allowedValues.join(', ')}.`
    );
  }

  return normalized;
}

function ensurePositiveNumber(value, fieldName) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new AppError(400, `${fieldName} must be a positive number.`);
  }

  return Number(parsed.toFixed(2));
}

function ensureDateOnly(value, fieldName) {
  const normalized = ensureRequiredString(value, fieldName);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    throw new AppError(400, `${fieldName} must use YYYY-MM-DD format.`);
  }

  const parsed = new Date(`${normalized}T00:00:00.000Z`);
  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== normalized
  ) {
    throw new AppError(400, `${fieldName} must be a valid calendar date.`);
  }

  return normalized;
}

function ensurePositiveInteger(value, fieldName, options = {}) {
  const { minimum = 1, maximum = Number.MAX_SAFE_INTEGER } = options;
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new AppError(
      400,
      `${fieldName} must be an integer between ${minimum} and ${maximum}.`
    );
  }

  return parsed;
}

function ensureBoolean(value, fieldName) {
  if (typeof value === 'boolean') {
    return value;
  }

  const normalized = ensureRequiredString(value, fieldName).toLowerCase();
  if (normalized === 'true') {
    return true;
  }

  if (normalized === 'false') {
    return false;
  }

  throw new AppError(400, `${fieldName} must be true or false.`);
}

function validateLoginInput(payload) {
  ensureObject(payload);

  return {
    email: ensureEmail(payload.email),
    password: ensureRequiredString(payload.password, 'password'),
  };
}

function validateUserPayload(payload, options = {}) {
  const { partial = false } = options;
  ensureObject(payload);

  const result = {};

  if (!partial || Object.hasOwn(payload, 'name')) {
    result.name = ensureRequiredString(payload.name, 'name');
  }

  if (!partial || Object.hasOwn(payload, 'email')) {
    result.email = ensureEmail(payload.email);
  }

  if (!partial || Object.hasOwn(payload, 'password')) {
    result.password = ensureRequiredString(payload.password, 'password');
  }

  if (!partial || Object.hasOwn(payload, 'role')) {
    result.role = ensureEnum(payload.role, 'role', USER_ROLES);
  }

  if (Object.hasOwn(payload, 'status')) {
    result.status = ensureEnum(payload.status, 'status', USER_STATUSES);
  } else if (!partial) {
    result.status = 'active';
  }

  if (partial && Object.keys(result).length === 0) {
    throw new AppError(400, 'At least one user field must be provided.');
  }

  return result;
}

function validateRecordPayload(payload, options = {}) {
  const { partial = false } = options;
  ensureObject(payload);

  const result = {};

  if (!partial || Object.hasOwn(payload, 'amount')) {
    result.amount = ensurePositiveNumber(payload.amount, 'amount');
  }

  if (!partial || Object.hasOwn(payload, 'type')) {
    result.type = ensureEnum(payload.type, 'type', RECORD_TYPES);
  }

  if (!partial || Object.hasOwn(payload, 'category')) {
    result.category = ensureRequiredString(payload.category, 'category');
  }

  if (!partial || Object.hasOwn(payload, 'entryDate')) {
    result.entryDate = ensureDateOnly(payload.entryDate, 'entryDate');
  }

  if (!partial || Object.hasOwn(payload, 'notes')) {
    result.notes = ensureOptionalString(payload.notes, 'notes') || '';
  }

  if (partial && Object.keys(result).length === 0) {
    throw new AppError(400, 'At least one record field must be provided.');
  }

  return result;
}

function validateRecordFilters(query = {}) {
  const page = query.page === undefined ? 1 : ensurePositiveInteger(query.page, 'page');
  const pageSize =
    query.pageSize === undefined
      ? 10
      : ensurePositiveInteger(query.pageSize, 'pageSize', {
          minimum: 1,
          maximum: 100,
        });

  const filters = {
    page,
    pageSize,
  };

  if (query.includeDeleted !== undefined) {
    filters.includeDeleted = ensureBoolean(query.includeDeleted, 'includeDeleted');
  }

  if (query.type !== undefined) {
    filters.type = ensureEnum(query.type, 'type', RECORD_TYPES);
  }

  if (query.category !== undefined) {
    filters.category = ensureRequiredString(query.category, 'category');
  }

  if (query.from !== undefined) {
    filters.from = ensureDateOnly(query.from, 'from');
  }

  if (query.to !== undefined) {
    filters.to = ensureDateOnly(query.to, 'to');
  }

  if (query.search !== undefined) {
    filters.search = ensureOptionalString(query.search, 'search', 100) || '';
  }

  if (filters.from && filters.to && filters.from > filters.to) {
    throw new AppError(400, 'from must be earlier than or equal to to.');
  }

  return filters;
}

function validateDashboardFilters(query = {}) {
  const filters = {};

  if (query.type !== undefined) {
    filters.type = ensureEnum(query.type, 'type', RECORD_TYPES);
  }

  if (query.category !== undefined) {
    filters.category = ensureRequiredString(query.category, 'category');
  }

  if (query.from !== undefined) {
    filters.from = ensureDateOnly(query.from, 'from');
  }

  if (query.to !== undefined) {
    filters.to = ensureDateOnly(query.to, 'to');
  }

  if (filters.from && filters.to && filters.from > filters.to) {
    throw new AppError(400, 'from must be earlier than or equal to to.');
  }

  filters.groupBy =
    query.groupBy === undefined
      ? 'month'
      : ensureEnum(query.groupBy, 'groupBy', ['month', 'week']);
  filters.recentLimit =
    query.limit === undefined
      ? 5
      : ensurePositiveInteger(query.limit, 'limit', {
          minimum: 1,
          maximum: 20,
        });

  return filters;
}

function validateId(value, fieldName = 'id') {
  return ensurePositiveInteger(value, fieldName, {
    minimum: 1,
    maximum: Number.MAX_SAFE_INTEGER,
  });
}

function validateIncludeDeleted(value) {
  if (value === undefined) {
    return false;
  }

  return ensureBoolean(value, 'includeDeleted');
}

module.exports = {
  USER_ROLES,
  USER_STATUSES,
  RECORD_TYPES,
  validateDashboardFilters,
  validateId,
  validateIncludeDeleted,
  validateLoginInput,
  validateRecordFilters,
  validateRecordPayload,
  validateUserPayload,
};
