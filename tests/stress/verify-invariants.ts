import { strict as assert } from 'node:assert';

export function verifyDurableReservationInvariant(input: {
  persistedReservations: number;
  initialStock: number;
}) {
  assert.equal(
    input.persistedReservations <= input.initialStock,
    true,
    'durable reservation invariant violated'
  );
}

export function verifyQueueDrainInvariant(input: {
  reservationQueueDepth: number;
  purchaseQueueDepth: number;
  expiryQueueDepth: number;
}) {
  assert.equal(
    input.reservationQueueDepth + input.purchaseQueueDepth + input.expiryQueueDepth,
    0,
    'queue drain invariant violated'
  );
}

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
