import Redis from 'ioredis';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { releaseExpiredReservations } from '../../services/lambdas/expiry-sweeper/src/worker';
import { buildServer } from '../../services/lambdas/local-api/src/server';

describe('expiry sweeper', () => {
  let redis!: Redis;

  beforeEach(async () => {
    process.env.REDIS_URL ??= 'redis://127.0.0.1:6379';
    redis = new Redis(process.env.REDIS_URL);
    await redis.flushdb();
  });

  afterEach(async () => {
    await redis.quit();
  });

  it('releases an expired reservation back to stock exactly once', async () => {
    const app = await buildServer();

    const reserveResponse = await app.inject({
      method: 'POST',
      url: '/sales/sale_sneaker_001/reservations',
      headers: { 'x-user-token': 'usr_tok_1', 'idempotency-key': 'expiry_worker_1' }
    });
    const reservationId = reserveResponse.json().reservationId as string;
    const expiredAtMs = Date.now() - 1_000;

    await redis.hset(`reservation:${reservationId}`, 'expiresAt', String(expiredAtMs));
    await redis.zadd('sale:sale_sneaker_001:expiries', expiredAtMs, reservationId);

    expect(await releaseExpiredReservations(new Date().toISOString())).toBe(1);
    expect(await releaseExpiredReservations(new Date().toISOString())).toBe(0);
    expect(await redis.hget(`reservation:${reservationId}`, 'status')).toBe('EXPIRED');
    expect(await redis.get('sale:sale_sneaker_001:stock')).toBe('10');

    await app.close();
  });
});
