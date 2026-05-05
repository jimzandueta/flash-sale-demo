import Redis from 'ioredis';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildServer } from '../../services/lambdas/local-api/src/server';

describe('reservation status endpoints', () => {
  let redis!: Redis;

  beforeEach(async () => {
    process.env.REDIS_URL ??= 'redis://127.0.0.1:6379';
    redis = new Redis(process.env.REDIS_URL);
    await redis.flushdb();
  });

  afterEach(async () => {
    await redis.quit();
  });

  it('lists active reservations across multiple sales and returns an individual reservation', async () => {
    const app = await buildServer();

    await app.inject({
      method: 'POST',
      url: '/sales/sale_sneaker_001/reservations',
      headers: { 'x-user-token': 'usr_tok_1', 'idempotency-key': 'status_1' }
    });

    const second = await app.inject({
      method: 'POST',
      url: '/sales/sale_jacket_002/reservations',
      headers: { 'x-user-token': 'usr_tok_1', 'idempotency-key': 'status_2' }
    });

    const listResponse = await app.inject({
      method: 'GET',
      url: '/reservations',
      headers: { 'x-user-token': 'usr_tok_1' }
    });

    expect(listResponse.statusCode).toBe(200);
    expect(listResponse.json().items).toHaveLength(2);

    const detailResponse = await app.inject({
      method: 'GET',
      url: `/reservations/${second.json().reservationId}`,
      headers: { 'x-user-token': 'usr_tok_1' }
    });

    expect(detailResponse.statusCode).toBe(200);
    expect(detailResponse.json()).toMatchObject({
      reservationId: second.json().reservationId,
      saleId: 'sale_jacket_002',
      status: 'RESERVED'
    });

    await app.close();
  });
});