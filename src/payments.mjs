import { nonnegativeInteger, positiveInteger } from './shared.mjs';

export function canRefund(capturedCents, refundedCents, requestedCents) {
  nonnegativeInteger(capturedCents, 'capturedCents');
  nonnegativeInteger(refundedCents, 'refundedCents');
  positiveInteger(requestedCents, 'requestedCents');
  if (refundedCents > capturedCents) throw new RangeError('Invalid refund history');
  return requestedCents <= capturedCents;
}

export function applyPayment(events, payment) {
  if (!Array.isArray(events) || typeof payment?.id !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(payment.id)) throw new TypeError('Invalid payment');
  positiveInteger(payment.amountCents, 'amountCents');
  return [...events.map(e => ({ ...e })), { id: payment.id, amountCents: payment.amountCents }];
}

export function paymentState(totalCents, paidCents) {
  nonnegativeInteger(totalCents, 'totalCents');
  nonnegativeInteger(paidCents, 'paidCents');
  return paidCents >= totalCents ? 'paid' : 'unpaid';
}
