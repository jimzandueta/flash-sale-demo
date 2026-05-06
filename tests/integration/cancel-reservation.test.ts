import Redis from 'ioredis';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildServer } from '../../services/lambdas/local-api/src/server';
import { ensureQueue, receiveSingleMessage, uniqueQueueName } from './helpers/localAws';

describe('cancel reservation endpoint', () => {
  let redis!: Redis;

  beforeEach(async () => {
    process.env.AWS_REGION = 'us-east-1';
    process.env.AWS_ACCESS_KEY_ID = 'test';
    process.env.AWS_SECRET_ACCESS_KEY = 'test';
    process.env.SQS_ENDPOINT = 'http://127.0.0.1:4566';
    process.env.RESERVATION_EVENTS_QUEUE_URL = await ensureQueue(uniqueQueueName('cancel-reservation-events'));
    process.env.PURCHASE_EVENTS_QUEUE_URL = await ensureQueue(uniqueQueueName('cancel-purchase-events'));
    process.env.EXPIRY_EVENTS_QUEUE_URL = await ensureQueue(uniqueQueueName('cancel-expiry-events'));
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

  it('publishes a reservation-cancelled durable event when cancel succeeds', async () => {
    const app = await buildServer();
    const reserveResponse = await app.inject({
      method: 'POST',
      url: '/sales/sale_sneaker_001/reservations',
      headers: { 'x-user-token': 'usr_tok_cancel_evt', 'idempotency-key': 'cancel_evt_1' }
    });
    const reservationId = reserveResponse.json().reservationId as string;

    await receiveSingleMessage(process.env.RESERVATION_EVENTS_QUEUE_URL as string);

    const response = await app.inject({
      method: 'DELETE',
      url: `/reservations/${reservationId}`,
      headers: { 'x-user-token': 'usr_tok_cancel_evt' }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: 'CANCELLED' });

    const message = await receiveSingleMessage(process.env.RESERVATION_EVENTS_QUEUE_URL as string);

    expect(message?.Body ? JSON.parse(message.Body) : null).toEqual({
      eventType: 'reservation-cancelled',
      eventId: `reservation-cancelled:${reservationId}`,
      occurredAt: expect.any(String),
      reservationId,
      saleId: 'sale_sneaker_001',
      userToken: 'usr_tok_cancel_evt'
    });

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
