import test from 'node:test';
import assert from 'node:assert/strict';
import { canTransition } from '../../src/orders.mjs';

test('R06 cancelled-terminal', () => {
  assert.equal(canTransition('cancelled', 'submitted'), false); assert.equal(canTransition('draft', 'submitted'), true); assert.equal(canTransition('paid', 'shipped'), true); assert.equal(canTransition('delivered', 'submitted'), false);
});
