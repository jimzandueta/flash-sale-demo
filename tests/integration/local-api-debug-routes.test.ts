import Redis from 'ioredis';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildServer } from '../../services/lambdas/local-api/src/server';
import {
  ensureQueue,
  getReservationRecord,
  receiveSingleMessage,
  resetReservationsTable,
  uniqueQueueName
} from './helpers/localAws';

describe('local api debug routes', () => {
  const tableName = 'flash-sale-reservations-local';
  let redis!: Redis;
  let expiryQueueUrl = '';

  beforeEach(async () => {
    process.env.AWS_REGION = 'us-east-1';
    process.env.AWS_ACCESS_KEY_ID = 'test';
    process.env.AWS_SECRET_ACCESS_KEY = 'test';
    process.env.SQS_ENDPOINT = 'http://127.0.0.1:4566';
    process.env.DYNAMO_ENDPOINT = 'http://127.0.0.1:8000';
    process.env.RESERVATIONS_TABLE = tableName;
    process.env.WORKER_POLL_WAIT_SECONDS = '1';
    process.env.WORKER_POLL_MAX_MESSAGES = '10';
    process.env.RESERVATION_EVENTS_QUEUE_URL = await ensureQueue(uniqueQueueName('debug-reservation-events'));
    process.env.PURCHASE_EVENTS_QUEUE_URL = await ensureQueue(uniqueQueueName('debug-purchase-events'));
    expiryQueueUrl = await ensureQueue(uniqueQueueName('debug-expiry-events'));
    process.env.EXPIRY_EVENTS_QUEUE_URL = expiryQueueUrl;

    redis = new Redis(process.env.REDIS_URL ?? 'redis://127.0.0.1:6379');
    await redis.flushdb();

    await resetReservationsTable(tableName);
  });

  afterEach(async () => {
    await redis.quit();
  });

  it('returns an observability snapshot and manually processes worker queues', async () => {
    const app = await buildServer();

    await app.inject({
      method: 'POST',
      url: '/sessions',
      payload: { displayName: 'Jim' }
    });

    const reserve = await app.inject({
      method: 'POST',
      url: '/sales/sale_sneaker_001/reservations',
      headers: {
        'x-user-token': 'usr_tok_123',
        'idempotency-key': 'dbg_res_1'
      }
    });

    expect(reserve.statusCode).toBe(200);

    const before = await app.inject({
      method: 'GET',
      url: '/debug/observability?userToken=usr_tok_123&page=products&cartCount=1&purchaseCount=0&activeSaleCount=1&userLabel=Jim'
    });

    expect(before.statusCode).toBe(200);
    expect(
      before.json().sqs.queues.some((queue: { visibleMessages: number | null }) => (queue.visibleMessages ?? 0) > 0)
    ).toBe(true);

    const process = await app.inject({
      method: 'POST',
      url: '/debug/process-worker'
    });

    expect(process.statusCode).toBe(200);
    expect(process.json()).toMatchObject({
      processed: {
        reservation: 1
      }
    });

    const after = await app.inject({
      method: 'GET',
      url: '/debug/observability?userToken=usr_tok_123&page=products&cartCount=1&purchaseCount=0&activeSaleCount=1&userLabel=Jim'
    });

    expect(after.statusCode).toBe(200);
    expect(after.json().dynamodb.shopperRecords).toHaveLength(1);
    expect(after.json().manualWorker).toMatchObject({
      lastRunAt: expect.any(String),
      lastResult: {
        reservation: 1,
        purchase: 0,
        expiry: 0
      }
    });

    await app.close();
  });

  it('returns zero processed counts when the worker is triggered with empty queues', async () => {
    const app = await buildServer();

    const response = await app.inject({
      method: 'POST',
      url: '/debug/process-worker'
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      processed: {
        reservation: 0,
        purchase: 0,
        expiry: 0
      }
    });

    await app.close();
  });

  it('runs an expiry sweep before polling queues when the debug worker is triggered', async () => {
    const app = await buildServer();

    const reserve = await app.inject({
      method: 'POST',
      url: '/sales/sale_sneaker_001/reservations',
      headers: {
        'x-user-token': 'usr_tok_123',
        'idempotency-key': 'dbg_expiry_1'
      }
    });

    expect(reserve.statusCode).toBe(200);
    const reservationId = reserve.json().reservationId as string;
    const expiredAtMs = Date.now() - 1_000;

    await redis.hset(`reservation:${reservationId}`, 'expiresAt', String(expiredAtMs));
    await redis.zadd('sale:sale_sneaker_001:expiries', expiredAtMs, reservationId);

    expect(await receiveSingleMessage(expiryQueueUrl)).toBeNull();

    const process = await app.inject({
      method: 'POST',
      url: '/debug/process-worker'
    });

    expect(process.statusCode).toBe(200);
    expect(process.json()).toMatchObject({
      processed: {
        reservation: 1,
        purchase: 0,
        expiry: 1
      }
    });
    expect(await getReservationRecord(tableName, reservationId)).toMatchObject({
      reservationId,
      saleId: 'sale_sneaker_001',
      userToken: 'usr_tok_123',
      status: 'EXPIRED'
    });
    expect(await receiveSingleMessage(expiryQueueUrl)).toBeNull();

    await app.close();
  });

  it('reports worker mode from LOCAL_WORKER_MODE instead of API-local legacy drift', async () => {
    process.env.LOCAL_WORKER_MODE = 'manual';
    delete process.env.WORKER_MANUAL_MODE;

    const app = await buildServer();

    const response = await app.inject({
      method: 'GET',
      url: '/debug/observability?page=product-list&cartCount=0&purchaseCount=0&activeSaleCount=2&userLabel=Jim&userToken=usr_tok_123'
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().workerMode).toBe('manual');

    await app.close();
  });

  it('reports heartbeat worker mode when LOCAL_WORKER_MODE is heartbeat', async () => {
    process.env.LOCAL_WORKER_MODE = 'heartbeat';
    delete process.env.WORKER_MANUAL_MODE;

    const app = await buildServer();

    const response = await app.inject({
      method: 'GET',
      url: '/debug/observability?page=product-list&cartCount=0&purchaseCount=0&activeSaleCount=2&userLabel=Jim&userToken=usr_tok_123'
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().workerMode).toBe('heartbeat');

    await app.close();
  });
});
