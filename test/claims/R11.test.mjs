import test from 'node:test';
import assert from 'node:assert/strict';
import { applyPayment } from '../../src/payments.mjs';

test('R11 payment-idempotency', () => {
  const e={id:'p1',amountCents:250}; const once=applyPayment([],e); assert.deepEqual(applyPayment(once,e),once); assert.equal(once.length,1); assert.throws(() => applyPayment(once,{id:'p1',amountCents:300}),/PAYMENT_ID_CONFLICT/); assert.equal(applyPayment(once,{id:'p2',amountCents:50}).length,2); assert.deepEqual(once,[e]);
});
