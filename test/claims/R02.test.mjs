import test from 'node:test';
import assert from 'node:assert/strict';
import { lineTotalCents } from '../../src/pricing.mjs';

test('R02 line-total', () => {
  assert.equal(lineTotalCents(125, 3), 375); assert.equal(lineTotalCents(0, 3), 0); assert.equal(lineTotalCents(1200, 1), 1200); assert.throws(() => lineTotalCents(10, 0), RangeError);
});
