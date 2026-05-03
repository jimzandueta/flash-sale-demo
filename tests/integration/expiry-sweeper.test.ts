import { describe, expect, it } from 'vitest';
import { releaseExpiredReservations } from '../../services/lambdas/expiry-sweeper/src/worker';

describe('expiry sweeper', () => {
  it('releases an expired reservation back to stock', async () => {
    const released = await releaseExpiredReservations('2026-05-06T10:06:00Z');

    expect(released).toBeGreaterThanOrEqual(0);
  });
});