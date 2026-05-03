import Redis from 'ioredis';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildServer } from '../../services/lambdas/local-api/src/server';

describe('reservation spike endpoint', () => {
  let redis!: Redis;

  beforeEach(async () => {
    process.env.REDIS_URL = 'redis://127.0.0.1:6379';
    redis = new Redis(process.env.REDIS_URL);
    await redis.flushdb();
  });

  afterEach(async () => {
    await redis.quit();
  });

  it('reserves once per user and blocks oversell for the in-memory spike', async () => {
    const app = await buildServer();

    const first = await app.inject({
      method: 'POST',
      url: '/sales/sale_sneaker_001/reservations',
      headers: { 'x-user-token': 'usr_tok_1' }
    });

    const duplicate = await app.inject({
      method: 'POST',
      url: '/sales/sale_sneaker_001/reservations',
      headers: { 'x-user-token': 'usr_tok_1' }
    });

    expect(first.statusCode).toBe(200);
    expect(first.json().status).toBe('RESERVED');
    expect(duplicate.statusCode).toBe(200);
    expect(duplicate.json().status).toBe('ALREADY_RESERVED');

    await app.close();
  });
});