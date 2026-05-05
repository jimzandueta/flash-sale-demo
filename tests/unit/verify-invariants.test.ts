import { describe, expect, it } from 'vitest';
import { verifyStockInvariant } from '../stress/verify-invariants';

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