import { describe, expect, it } from 'vitest';
import {
  verifyDurableReservationInvariant,
  verifyQueueDrainInvariant,
  verifyStockInvariant
} from '../stress/verify-invariants';

describe('verifyStockInvariant', () => {
  it('allows totals that do not exceed initial stock', () => {
    expect(() =>
      verifyStockInvariant({
        purchased: 1,
        activeReserved: 1,
        remainingStock: 0,
        initialStock: 2
      })
    ).not.toThrow();
  });

  it('throws when accounted stock exceeds initial stock', () => {
    expect(() =>
      verifyStockInvariant({
        purchased: 1,
        activeReserved: 1,
        remainingStock: 1,
        initialStock: 2
      })
    ).toThrow('stock invariant violated');
  });
});

describe('verifyDurableReservationInvariant', () => {
  it('allows persisted reservations that do not exceed initial stock', () => {
    expect(() =>
      verifyDurableReservationInvariant({
        persistedReservations: 2,
        initialStock: 10
      })
    ).not.toThrow();
  });

  it('throws when persisted reservations exceed initial stock', () => {
    expect(() =>
      verifyDurableReservationInvariant({
        persistedReservations: 11,
        initialStock: 10
      })
    ).toThrow('durable reservation invariant violated');
  });
});

describe('verifyQueueDrainInvariant', () => {
  it('allows fully drained queues', () => {
    expect(() =>
      verifyQueueDrainInvariant({
        reservationQueueDepth: 0,
        purchaseQueueDepth: 0,
        expiryQueueDepth: 0
      })
    ).not.toThrow();
  });

  it('throws when any queue still has messages', () => {
    expect(() =>
      verifyQueueDrainInvariant({
        reservationQueueDepth: 1,
        purchaseQueueDepth: 0,
        expiryQueueDepth: 0
      })
    ).toThrow('queue drain invariant violated');
  });
});
