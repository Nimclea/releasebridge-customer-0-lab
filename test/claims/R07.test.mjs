import test from 'node:test';
import assert from 'node:assert/strict';
import { canRefund } from '../../src/payments.mjs';

test('R07 refund-balance', () => {
  assert.equal(canRefund(1000, 800, 300), false); assert.equal(canRefund(1000, 800, 200), true); assert.equal(canRefund(1000, 0, 1000), true); assert.throws(() => canRefund(1000, 1001, 1), RangeError);
});
