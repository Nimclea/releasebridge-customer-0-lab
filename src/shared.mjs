export function nonnegativeInteger(value, name = 'value') {
  if (!Number.isSafeInteger(value) || value < 0) throw new RangeError(name + ' must be a nonnegative safe integer');
  return value;
}
export function positiveInteger(value, name = 'value') {
  nonnegativeInteger(value, name);
  if (value === 0) throw new RangeError(name + ' must be positive');
  return value;
}
