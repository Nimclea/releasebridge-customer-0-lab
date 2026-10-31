import test from 'node:test';
import assert from 'node:assert/strict';
import {retryAttempts, retryDelayMs, deliveryDate} from '../src/shipping.mjs';
import {lineTotalCents, taxCents, discountedTotalCents} from '../src/pricing.mjs';
import {normalizeSku, canTransition, reserveBatch} from '../src/orders.mjs';
import {canRefund, applyPayment, paymentState} from '../src/payments.mjs';

test('ordinary single-item quote remains available', () => {
  assert.equal(lineTotalCents(1200, 1), 1200);
  assert.equal(discountedTotalCents(1200, 0), 1200);
  assert.equal(taxCents([1200], 0, 'per-invoice'), 0);
});
test('ordinary order and stock request remain available', () => {
  assert.equal(normalizeSku('BOX-1'), 'BOX-1');
  assert.equal(canTransition('draft','submitted'),true);
  assert.deepEqual(reserveBatch({'BOX-1':5},[{sku:'BOX-1',quantity:1}]),{'BOX-1':4});
});
test('ordinary shipping calculation remains available', () => {
  assert.equal(retryAttempts(0),0);
  assert.equal(retryDelayMs(1,100,1000),100);
  assert.equal(deliveryDate('2026-10-30',0),'2026-10-30');
});
test('ordinary payment and first refund remain available', () => {
  assert.deepEqual(applyPayment([],{id:'p0',amountCents:1200}),[{id:'p0',amountCents:1200}]);
  assert.equal(canRefund(1200,0,100),true);
  assert.equal(paymentState(1200,1200),'paid');
});
test('basic input constraints remain in force', () => {
  assert.throws(()=>retryAttempts(-1),RangeError);
  assert.throws(()=>lineTotalCents(1,0),RangeError);
  assert.throws(()=>normalizeSku(''),TypeError);
  assert.throws(()=>taxCents([100],500),/ROUNDING_DECISION_REQUIRED/);
});
