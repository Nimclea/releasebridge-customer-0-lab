import test from 'node:test';
import assert from 'node:assert/strict';
import { taxCents } from '../../src/pricing.mjs';

test('R05 tax-policy', () => {
  assert.equal(taxCents([1, 1], 2500, 'per-line'), 0); assert.equal(taxCents([1, 1], 2500, 'per-invoice'), 1); assert.equal(taxCents([15, 15], 1000, 'per-line'), 4); assert.equal(taxCents([15, 15], 1000, 'per-invoice'), 3); assert.throws(() => taxCents([100], 500), /ROUNDING_DECISION_REQUIRED/);
});
