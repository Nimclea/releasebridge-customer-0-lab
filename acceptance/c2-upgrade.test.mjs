import test from 'node:test';
import assert from 'node:assert/strict';
import { retryAttempts } from '../src/shipping.mjs';

// Future, explicitly authorized C2 upgrade. Not part of baseline calibration.
test('C2 optional maxAttempts cap preserves all original default behavior', () => {
  assert.equal(retryAttempts(3), 3);
  assert.equal(retryAttempts(0), 0);
  assert.equal(retryAttempts(3, { maxAttempts: 2 }), 2);
  assert.equal(retryAttempts(2, { maxAttempts: 10 }), 2);
  assert.equal(retryAttempts(3, { maxAttempts: 0 }), 0);
  assert.throws(() => retryAttempts(3, { maxAttempts: -1 }), RangeError);
});
