import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeSku } from '../../src/orders.mjs';

test('R03 sku-normalization', () => {
  assert.equal(normalizeSku('  ab-12  '), 'AB-12'); assert.equal(normalizeSku('BOX-1'), 'BOX-1'); assert.throws(() => normalizeSku(''), TypeError); assert.throws(() => normalizeSku('x/y'), TypeError);
});
