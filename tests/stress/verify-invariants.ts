import { strict as assert } from 'node:assert';

export function verifyStockInvariant(input: {
  purchased: number;
  activeReserved: number;
  remainingStock: number;
  initialStock: number;
}) {
  assert.equal(
    input.purchased + input.activeReserved + input.remainingStock <= input.initialStock,
    true,
    'stock invariant violated'
  );
}