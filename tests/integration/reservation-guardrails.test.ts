import Redis from 'ioredis';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildServer } from '../../services/lambdas/local-api/src/server';

describe('reservation route guardrails', () => {
  let redis!: Redis;

  beforeEach(async () => {
    process.env.REDIS_URL ??= 'redis://127.0.0.1:6379';
    redis = new Redis(process.env.REDIS_URL);
    await redis.flushdb();
  });

  afterEach(async () => {
    await redis.quit();
  });

  it('requires x-user-token for reservation creation and reservation reads', async () => {
    const app = await buildServer();

    const createResponse = await app.inject({
      method: 'POST',
      url: '/sales/sale_sneaker_001/reservations',
      headers: { 'idempotency-key': 'guardrail_missing_user' }
    });

    expect(createResponse.statusCode).toBe(401);
    expect(createResponse.json()).toEqual({ status: 'USER_TOKEN_REQUIRED' });

    const listResponse = await app.inject({
      method: 'GET',
      url: '/reservations'
    });

    expect(listResponse.statusCode).toBe(401);
    expect(listResponse.json()).toEqual({ status: 'USER_TOKEN_REQUIRED' });

    await app.close();
  });

  it('returns SALE_NOT_ACTIVE for a known sale that is not active', async () => {
    const app = await buildServer();

    const response = await app.inject({
      method: 'POST',
      url: '/sales/sale_cap_003/reservations',
      headers: {
        'x-user-token': 'usr_tok_guardrail_1',
        'idempotency-key': 'guardrail_not_active'
      }
    });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual({ status: 'SALE_NOT_ACTIVE' });

    await app.close();
  });

  it('replays the original reservation for the same idempotency key and blocks a new duplicate key', async () => {
    const app = await buildServer();

    const first = await app.inject({
      method: 'POST',
      url: '/sales/sale_sneaker_001/reservations',
      headers: {
        'x-user-token': 'usr_tok_guardrail_2',
        'idempotency-key': 'guardrail_same_key'
      }
    });

    const replay = await app.inject({
      method: 'POST',
      url: '/sales/sale_sneaker_001/reservations',
      headers: {
        'x-user-token': 'usr_tok_guardrail_2',
        'idempotency-key': 'guardrail_same_key'
      }
    });

    const duplicate = await app.inject({
      method: 'POST',
      url: '/sales/sale_sneaker_001/reservations',
      headers: {
        'x-user-token': 'usr_tok_guardrail_2',
        'idempotency-key': 'guardrail_new_key'
      }
    });

    expect(first.statusCode).toBe(200);
    expect(first.json().status).toBe('RESERVED');
    expect(replay.statusCode).toBe(200);
    expect(replay.json()).toEqual(first.json());
    expect(duplicate.statusCode).toBe(200);
    expect(duplicate.json()).toEqual({ status: 'ALREADY_RESERVED' });

    await app.close();
  });
});