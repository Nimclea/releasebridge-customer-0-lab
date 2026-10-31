import test from 'node:test';
import assert from 'node:assert/strict';
import { discountedTotalCents } from '../../src/pricing.mjs';

test('R09 discount-floor', () => {
  assert.equal(discountedTotalCents(100, 250), 0); assert.equal(discountedTotalCents(100, 20), 80); assert.equal(discountedTotalCents(0, 10), 0); assert.throws(() => discountedTotalCents(100, -1), RangeError);
});
