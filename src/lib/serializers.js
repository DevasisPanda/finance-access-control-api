function toIsoTimestamp(value) {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  return String(value);
}

function toDateOnly(value) {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }

  return String(value).slice(0, 10);
}

function toNumber(value) {
  if (value === null || value === undefined) {
    return null;
  }

  return Number(value);
}

module.exports = {
  toDateOnly,
  toIsoTimestamp,
  toNumber,
};
