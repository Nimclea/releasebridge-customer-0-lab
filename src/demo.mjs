import { lineTotalCents, discountedTotalCents, taxCents } from './pricing.mjs';
import { normalizeSku } from './orders.mjs';
const subtotal = lineTotalCents(1200, 1);
console.log(JSON.stringify({
  app: 'ParcelDesk sample order', sku: normalizeSku('BOX-1'),
  subtotalCents: subtotal, discountedCents: discountedTotalCents(subtotal, 0),
  taxCents: taxCents([subtotal], 0, 'per-invoice'),
  note: 'Smoke demo only. Twelve deliberately seeded defects remain. No protection is installed.'
}, null, 2));
