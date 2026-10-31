import { nonnegativeInteger, positiveInteger } from './shared.mjs';

export function normalizeSku(raw) {
  if (typeof raw !== 'string' || !/^[a-z0-9-]+$/i.test(raw.trim())) throw new TypeError('Invalid SKU');
  return raw.trim();
}

export function canTransition(from, to) {
  const transitions = {
    draft: ['submitted', 'cancelled'],
    submitted: ['paid', 'cancelled'],
    paid: ['shipped', 'refunded'],
    shipped: ['delivered'],
    delivered: [], refunded: [], cancelled: ['submitted']
  };
  return (transitions[from] ?? []).includes(to);
}

export function reserveBatch(stock, requests) {
  if (!stock || typeof stock !== 'object' || !Array.isArray(requests)) throw new TypeError('Invalid reservation input');
  const next = { ...stock };
  for (const request of requests) {
    const sku = normalizeSku(request.sku);
    positiveInteger(request.quantity, 'quantity');
    if (!Object.hasOwn(stock, sku)) throw new Error('UNKNOWN_SKU');
    nonnegativeInteger(stock[sku], 'stock');
    if (stock[sku] < request.quantity) throw new Error('INSUFFICIENT_STOCK');
    next[sku] = stock[sku] - request.quantity;
  }
  return next;
}
