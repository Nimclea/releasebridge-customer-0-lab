import test from 'node:test';
import assert from 'node:assert/strict';
import { retryDelayMs } from '../../src/shipping.mjs';

test('R04 retry-cap', () => {
  assert.equal(retryDelayMs(5, 100, 250), 250); assert.equal(retryDelayMs(1, 100, 250), 100); assert.equal(retryDelayMs(4, 100, 250), 250); assert.equal(retryDelayMs(2, 100, 0), 0); assert.throws(() => retryDelayMs(0, 100, 250), RangeError);
});
