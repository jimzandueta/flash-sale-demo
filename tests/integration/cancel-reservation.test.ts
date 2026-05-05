import Redis from 'ioredis';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildServer } from '../../services/lambdas/local-api/src/server';

describe('cancel reservation endpoint', () => {
  let redis!: Redis;

  beforeEach(async () => {
    process.env.REDIS_URL ??= 'redis://127.0.0.1:6379';
    redis = new Redis(process.env.REDIS_URL);
    await redis.flushdb();
  });

  afterEach(async () => {
    await redis.quit();
  });

  it('returns CANCELLED, restores stock, and removes the active reservation keys', async () => {
    const app = await buildServer();
    const reserveResponse = await app.inject({
      method: 'POST',
      url: '/sales/sale_sneaker_001/reservations',
      headers: { 'x-user-token': 'usr_tok_1', 'idempotency-key': 'cancel_1' }
    });
    const reservationId = reserveResponse.json().reservationId as string;

    const response = await app.inject({
      method: 'DELETE',
      url: `/reservations/${reservationId}`,
      headers: { 'x-user-token': 'usr_tok_1' }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: 'CANCELLED' });
    expect(await redis.get('sale:sale_sneaker_001:stock')).toBe('10');
    expect(await redis.exists(`reservation:${reservationId}`)).toBe(0);
    expect(await redis.smembers('user:usr_tok_1:reservations')).toEqual([]);

    await app.close();
  });

  it('returns FORBIDDEN when another user attempts the cancel', async () => {
    const app = await buildServer();
    const reserveResponse = await app.inject({
      method: 'POST',
      url: '/sales/sale_sneaker_001/reservations',
      headers: { 'x-user-token': 'usr_tok_owner', 'idempotency-key': 'cancel_2' }
    });
    const reservationId = reserveResponse.json().reservationId as string;

    const response = await app.inject({
      method: 'DELETE',
      url: `/reservations/${reservationId}`,
      headers: { 'x-user-token': 'usr_tok_other' }
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({ status: 'FORBIDDEN' });

    await app.close();
  });

  it('returns NOT_FOUND for an unknown reservation id', async () => {
    const app = await buildServer();

    const response = await app.inject({
      method: 'DELETE',
      url: '/reservations/res_missing',
      headers: { 'x-user-token': 'usr_tok_1' }
    });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({ status: 'NOT_FOUND' });

    await app.close();
  });

  it('returns ALREADY_PURCHASED once checkout has completed', async () => {
    const app = await buildServer();
    const reserveResponse = await app.inject({
      method: 'POST',
      url: '/sales/sale_sneaker_001/reservations',
      headers: { 'x-user-token': 'usr_tok_1', 'idempotency-key': 'cancel_3' }
    });
    const reservationId = reserveResponse.json().reservationId as string;

    await app.inject({
      method: 'POST',
      url: `/reservations/${reservationId}/checkout`,
      headers: { 'x-user-token': 'usr_tok_1', 'idempotency-key': 'cancel_4' },
      payload: { simulateFailure: false }
    });

    const response = await app.inject({
      method: 'DELETE',
      url: `/reservations/${reservationId}`,
      headers: { 'x-user-token': 'usr_tok_1' }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: 'ALREADY_PURCHASED' });

    await app.close();
  });
});
