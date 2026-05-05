import Redis from 'ioredis';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildServer } from '../../services/lambdas/local-api/src/server';

describe('checkout endpoint', () => {
  let redis!: Redis;

  beforeEach(async () => {
    process.env.REDIS_URL ??= 'redis://127.0.0.1:6379';
    redis = new Redis(process.env.REDIS_URL);
    await redis.flushdb();
  });

  afterEach(async () => {
    await redis.quit();
  });

  it('marks an active reservation PURCHASED and removes it from active indexes', async () => {
    const app = await buildServer();

    const reserveResponse = await app.inject({
      method: 'POST',
      url: '/sales/sale_sneaker_001/reservations',
      headers: { 'x-user-token': 'usr_tok_1', 'idempotency-key': 'checkout_purchase_1' }
    });
    const reservationId = reserveResponse.json().reservationId as string;

    const response = await app.inject({
      method: 'POST',
      url: `/reservations/${reservationId}/checkout`,
      headers: { 'x-user-token': 'usr_tok_1', 'idempotency-key': 'checkout_purchase_2' },
      payload: { simulateFailure: false }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ status: 'PURCHASED', reservationId });
    expect(await redis.hget(`reservation:${reservationId}`, 'status')).toBe('PURCHASED');
    expect(await redis.smembers('user:usr_tok_1:reservations')).toEqual([]);
    expect(await redis.zrange('sale:sale_sneaker_001:expiries', 0, -1)).toEqual([]);
    expect(await redis.get('sale:sale_sneaker_001:stock')).toBe('9');

    await app.close();
  });

  it('returns PAYMENT_FAILED without mutating the live reservation', async () => {
    const app = await buildServer();

    const reserveResponse = await app.inject({
      method: 'POST',
      url: '/sales/sale_sneaker_001/reservations',
      headers: { 'x-user-token': 'usr_tok_1', 'idempotency-key': 'checkout_failure_1' }
    });
    const reservationId = reserveResponse.json().reservationId as string;

    const response = await app.inject({
      method: 'POST',
      url: `/reservations/${reservationId}/checkout`,
      headers: { 'x-user-token': 'usr_tok_1', 'idempotency-key': 'checkout_failure_2' },
      payload: { simulateFailure: true }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: 'PAYMENT_FAILED', reservationId });
    expect(await redis.hget(`reservation:${reservationId}`, 'status')).toBe('RESERVED');
    expect(await redis.smembers('user:usr_tok_1:reservations')).toEqual([reservationId]);
    expect(await redis.get('sale:sale_sneaker_001:stock')).toBe('9');

    await app.close();
  });

  it('returns RESERVATION_EXPIRED and releases stock when the hold has timed out', async () => {
    const app = await buildServer();

    const reserveResponse = await app.inject({
      method: 'POST',
      url: '/sales/sale_sneaker_001/reservations',
      headers: { 'x-user-token': 'usr_tok_1', 'idempotency-key': 'checkout_expired_1' }
    });
    const reservationId = reserveResponse.json().reservationId as string;
    const expiredAtMs = Date.now() - 1_000;

    await redis.hset(`reservation:${reservationId}`, 'expiresAt', String(expiredAtMs));
    await redis.zadd('sale:sale_sneaker_001:expiries', expiredAtMs, reservationId);

    const response = await app.inject({
      method: 'POST',
      url: `/reservations/${reservationId}/checkout`,
      headers: { 'x-user-token': 'usr_tok_1', 'idempotency-key': 'checkout_expired_2' },
      payload: { simulateFailure: false }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: 'RESERVATION_EXPIRED', reservationId });
    expect(await redis.hget(`reservation:${reservationId}`, 'status')).toBe('EXPIRED');
    expect(await redis.smembers('user:usr_tok_1:reservations')).toEqual([]);
    expect(await redis.zrange('sale:sale_sneaker_001:expiries', 0, -1)).toEqual([]);
    expect(await redis.get('sale:sale_sneaker_001:stock')).toBe('10');

    await app.close();
  });
});
