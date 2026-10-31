import test from 'node:test';
import assert from 'node:assert/strict';
import { retryAttempts } from '../../src/shipping.mjs';

test('R01 retry-count', () => {
  assert.equal(retryAttempts(3), 3); assert.equal(retryAttempts(1), 1); assert.equal(retryAttempts(0), 0); assert.throws(() => retryAttempts(-1), RangeError); assert.throws(() => retryAttempts(1.5), RangeError);
});
