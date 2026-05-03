import Redis from 'ioredis';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildServer } from '../../services/lambdas/local-api/src/server';

describe('redis reservation path', () => {
  let redis!: Redis;

  beforeEach(async () => {
    process.env.REDIS_URL = 'redis://127.0.0.1:6379';
    redis = new Redis(process.env.REDIS_URL);
    await redis.flushdb();
  });

  afterEach(async () => {
    await redis.quit();
  });

  it('persists reservation state across a server rebuild while still allowing the same user to reserve a different active sale', async () => {
    const firstApp = await buildServer();

    const first = await firstApp.inject({
      method: 'POST',
      url: '/sales/sale_sneaker_001/reservations',
      headers: { 'x-user-token': 'usr_tok_redis_1', 'idempotency-key': 'k1' }
    });

    await firstApp.close();

    const secondApp = await buildServer();

    const duplicate = await secondApp.inject({
      method: 'POST',
      url: '/sales/sale_sneaker_001/reservations',
      headers: { 'x-user-token': 'usr_tok_redis_1', 'idempotency-key': 'k2' }
    });

    const secondSale = await secondApp.inject({
      method: 'POST',
      url: '/sales/sale_jacket_002/reservations',
      headers: { 'x-user-token': 'usr_tok_redis_1', 'idempotency-key': 'k3' }
    });

    expect(first.json().status).toBe('RESERVED');
    expect(duplicate.json().status).toBe('ALREADY_RESERVED');
    expect(secondSale.json().status).toBe('RESERVED');

    await secondApp.close();
  });
});