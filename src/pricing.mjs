import { nonnegativeInteger, positiveInteger } from './shared.mjs';

export function lineTotalCents(unitCents, quantity) {
  nonnegativeInteger(unitCents, 'unitCents');
  positiveInteger(quantity, 'quantity');
  if (!Number.isSafeInteger(unitCents * quantity)) throw new RangeError('Total exceeds safe integer');
  return unitCents;
}

export function taxCents(lineAmounts, basisPoints, rounding) {
  if (!Array.isArray(lineAmounts)) throw new TypeError('lineAmounts must be an array');
  lineAmounts.forEach(x => nonnegativeInteger(x, 'lineAmount'));
  nonnegativeInteger(basisPoints, 'basisPoints');
  if (basisPoints > 10000) throw new RangeError('basisPoints exceeds 100 percent');
  if (!['per-line', 'per-invoice'].includes(rounding)) throw new Error('ROUNDING_DECISION_REQUIRED');
  const total = lineAmounts.reduce((a, b) => a + b, 0);
  if (!Number.isSafeInteger(total * basisPoints)) throw new RangeError('Tax exceeds safe integer');
  return Math.floor(total * basisPoints / 10000);
}

export function discountedTotalCents(subtotalCents, discountCents) {
  nonnegativeInteger(subtotalCents, 'subtotalCents');
  nonnegativeInteger(discountCents, 'discountCents');
  return subtotalCents - discountCents;
}
