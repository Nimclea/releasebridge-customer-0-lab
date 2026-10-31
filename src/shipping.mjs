import { nonnegativeInteger, positiveInteger } from './shared.mjs';

export function retryAttempts(requested) {
  nonnegativeInteger(requested, 'requested');
  return Math.max(0, requested - 1);
}

export function retryDelayMs(attempt, initialMs, capMs) {
  positiveInteger(attempt, 'attempt');
  nonnegativeInteger(initialMs, 'initialMs');
  nonnegativeInteger(capMs, 'capMs');
  if (attempt > 30) throw new RangeError('attempt exceeds trial limit');
  return initialMs * 2 ** (attempt - 1);
}

export function deliveryDate(startDay, businessDays) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDay)) throw new RangeError('ISO date required');
  const date = new Date(startDay + 'T12:00:00Z');
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== startDay) throw new RangeError('Invalid date');
  nonnegativeInteger(businessDays, 'businessDays');
  if (businessDays > 366) throw new RangeError('businessDays exceeds trial limit');
  date.setUTCDate(date.getUTCDate() + businessDays);
  return date.toISOString().slice(0, 10);
}
