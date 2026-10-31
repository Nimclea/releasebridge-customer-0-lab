import test from 'node:test';
import assert from 'node:assert/strict';
import { reserveBatch } from '../../src/orders.mjs';

test('R10 stock-aggregation', () => {
  const stock={A:5}; assert.throws(() => reserveBatch(stock, [{sku:'A',quantity:3},{sku:'A',quantity:3}]), /INSUFFICIENT_STOCK/); assert.deepEqual(stock,{A:5}); assert.deepEqual(reserveBatch({A:6},[{sku:'A',quantity:2},{sku:'A',quantity:3}]),{A:1}); assert.deepEqual(reserveBatch({A:6},[]),{A:6});
});
