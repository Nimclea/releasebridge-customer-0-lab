import test from 'node:test';
import assert from 'node:assert/strict';
import { deliveryDate } from '../../src/shipping.mjs';

test('R08 business-delivery', () => {
  assert.equal(deliveryDate('2026-10-30', 1), '2026-11-02'); assert.equal(deliveryDate('2026-10-30', 2), '2026-11-03'); assert.equal(deliveryDate('2026-10-31', 1), '2026-11-02'); assert.equal(deliveryDate('2026-10-30', 0), '2026-10-30'); assert.throws(() => deliveryDate('2026-02-30', 1), RangeError);
});
