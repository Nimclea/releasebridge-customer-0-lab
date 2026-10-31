import test from 'node:test';
import assert from 'node:assert/strict';
import { paymentState } from '../../src/payments.mjs';

test('R12 partial-payment', () => {
  assert.equal(paymentState(1000,250),'partial'); assert.equal(paymentState(1000,0),'unpaid'); assert.equal(paymentState(1000,1000),'paid'); assert.equal(paymentState(0,0),'paid'); assert.throws(() => paymentState(100,-1),RangeError);
});
