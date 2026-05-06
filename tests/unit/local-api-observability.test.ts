import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  buildObservabilitySnapshot,
  readRedisObservability,
  readDynamoObservability
} from '../../services/lambdas/local-api/src/debug/observability';

const send = vi.fn();

vi.mock('../../services/lambdas/shared/src/config', () => ({
  getAppConfig: () => ({
    reservationsTable: 'flash-sale-reservations-local'
  })
}));

vi.mock('../../services/lambdas/shared/src/dynamoClient', () => ({
  createDynamoClient: () => ({ send })
}));

describe('buildObservabilitySnapshot', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('builds a normalized snapshot from frontend app state and backend subsystem reads', async () => {
    const snapshot = await buildObservabilitySnapshot({
      workerMode: 'manual',
      app: {
        page: 'checkout',
        cartCount: 2,
        purchaseCount: 1,
        activeSaleCount: 3,
        userLabel: 'Jim'
      },
      shopper: {
        userToken: 'usr_tok_123',
        displayName: 'Jim'
      },
      readRedis: async () => ({
        status: 'ok',
        stockBySale: [{ saleId: 'sale_founder_001', stock: 9 }],
        userReservationIds: ['res_1'],
        reservations: [
          {
            reservationId: 'res_1',
            saleId: 'sale_founder_001',
            userToken: 'usr_tok_123',
            status: 'RESERVED',
            expiresAt: '2026-05-05T10:05:00.000Z'
          }
        ],
        expiryQueues: [{ saleId: 'sale_founder_001', size: 1 }]
      }),
      readSqs: async () => ({
        status: 'ok',
        queues: [
          {
            type: 'purchase',
            queueUrl: 'http://localstack:4566/000000000000/dev-purchase-events',
            visibleMessages: 1,
            inFlightMessages: 0
          }
        ]
      }),
      readDynamo: async () => ({
        status: 'ok',
        tableName: 'flash-sale-reservations-local',
        shopperRecords: [
          {
            reservationId: 'res_1',
            saleId: 'sale_founder_001',
            userToken: 'usr_tok_123',
            status: 'PURCHASED',
            purchasedAt: '2026-05-05T10:01:00.000Z',
            updatedAt: '2026-05-05T10:01:00.000Z'
          }
        ]
      }),
      manualWorker: {
        lastRunAt: '2026-05-05T10:02:00.000Z',
        lastResult: { reservation: 0, purchase: 1, expiry: 0 }
      }
    });

    expect(snapshot.workerMode).toBe('manual');
    expect(snapshot.app).toEqual({
      page: 'checkout',
      cartCount: 2,
      purchaseCount: 1,
      activeSaleCount: 3,
      userLabel: 'Jim',
      pendingSqsCount: 1
    });
    expect(snapshot.pipeline.map((stage) => stage.stage)).toEqual([
      'shopper',
      'redis',
      'sqs',
      'worker',
      'dynamodb'
    ]);
    expect(snapshot.sqs.queues[0].visibleMessages).toBe(1);
    expect(snapshot.dynamodb.shopperRecords[0].status).toBe('PURCHASED');
  });

  it('degrades to warning or unavailable states when a subsystem read fails', async () => {
    const snapshot = await buildObservabilitySnapshot({
      workerMode: 'manual',
      app: {
        page: 'product-list',
        cartCount: 1,
        purchaseCount: 0,
        activeSaleCount: 1,
        userLabel: 'Jim'
      },
      shopper: {
        userToken: 'usr_tok_123',
        displayName: 'Jim'
      },
      readRedis: async () => ({
        status: 'ok',
        stockBySale: [],
        userReservationIds: [],
        reservations: [],
        expiryQueues: []
      }),
      readSqs: async () => ({
        status: 'unavailable',
        queues: [
          {
            type: 'reservation',
            queueUrl: 'http://localstack:4566/000000000000/dev-reservation-events',
            visibleMessages: null,
            inFlightMessages: null
          }
        ]
      }),
      readDynamo: async () => ({
        status: 'ok',
        tableName: 'flash-sale-reservations-local',
        shopperRecords: []
      }),
      manualWorker: {
        lastError: 'SQS unavailable'
      }
    });

    expect(snapshot.app.pendingSqsCount).toBeNull();
    expect(snapshot.sqs.status).toBe('unavailable');
    expect(snapshot.pipeline.find((stage) => stage.stage === 'sqs')?.status).toBe('unavailable');
    expect(snapshot.pipeline.find((stage) => stage.stage === 'sqs')?.summary).toBe('Queue data unavailable');
    expect(snapshot.pipeline.find((stage) => stage.stage === 'worker')?.status).toBe('warning');
    expect(snapshot.pipeline.find((stage) => stage.stage === 'worker')?.summary).toBe('SQS unavailable');
  });

  it('returns a snapshot instead of throwing when sqs and dynamodb reads error', async () => {
    const snapshot = await buildObservabilitySnapshot({
      workerMode: 'manual',
      app: {
        page: 'product-list',
        cartCount: 1,
        purchaseCount: 0,
        activeSaleCount: 2,
        userLabel: 'Jim'
      },
      shopper: {
        userToken: 'usr_tok_123',
        displayName: 'Jim'
      },
      readRedis: async () => ({
        status: 'ok',
        stockBySale: [{ saleId: 'sale_sneaker_001', stock: 9 }],
        userReservationIds: ['res_1'],
        reservations: [
          {
            reservationId: 'res_1',
            saleId: 'sale_sneaker_001',
            userToken: 'usr_tok_123',
            status: 'RESERVED',
            expiresAt: '2026-05-05T10:05:00.000Z'
          }
        ],
        expiryQueues: [{ saleId: 'sale_sneaker_001', size: 1 }]
      }),
      readSqs: async () => {
        throw new Error('The security token included in the request is invalid.');
      },
      readDynamo: async () => {
        throw new Error('The security token included in the request is invalid.');
      },
      manualWorker: {}
    });

    expect(snapshot.redis.status).toBe('ok');
    expect(snapshot.redis.reservations).toHaveLength(1);
    expect(snapshot.app.pendingSqsCount).toBeNull();
    expect(snapshot.sqs.status).toBe('unavailable');
    expect(snapshot.sqs.queues).toEqual([]);
    expect(snapshot.dynamodb.status).toBe('unavailable');
    expect(snapshot.dynamodb.shopperRecords).toEqual([]);
  });

  it('uses heartbeat-aware worker summary text when no manual run has happened', async () => {
    const snapshot = await buildObservabilitySnapshot({
      workerMode: 'heartbeat',
      app: {
        page: 'product-list',
        cartCount: 0,
        purchaseCount: 0,
        activeSaleCount: 1,
        userLabel: 'Jim'
      },
      shopper: {
        userToken: 'usr_tok_123',
        displayName: 'Jim'
      },
      readRedis: async () => ({
        status: 'ok',
        stockBySale: [],
        userReservationIds: [],
        reservations: [],
        expiryQueues: []
      }),
      readSqs: async () => ({
        status: 'ok',
        queues: []
      }),
      readDynamo: async () => ({
        status: 'ok',
        tableName: 'flash-sale-reservations-local',
        shopperRecords: []
      }),
      manualWorker: {}
    });

    expect(snapshot.pipeline.find((stage) => stage.stage === 'worker')?.summary).toBe(
      'Heartbeat polling is active'
    );
  });

  it('returns all durable shopper records newest-first even when a shopper token is present', async () => {
    const snapshot = await buildObservabilitySnapshot({
      workerMode: 'manual',
      app: {
        page: 'product-list',
        cartCount: 1,
        purchaseCount: 0,
        activeSaleCount: 2,
        userLabel: 'Jim'
      },
      shopper: {
        userToken: 'usr_tok_123',
        displayName: 'Jim'
      },
      readRedis: async () => ({
        status: 'ok',
        stockBySale: [],
        userReservationIds: [],
        reservations: [],
        expiryQueues: []
      }),
      readSqs: async () => ({
        status: 'ok',
        queues: []
      }),
      readDynamo: async () => ({
        status: 'ok',
        tableName: 'flash-sale-reservations-local',
        shopperRecords: [
          {
            reservationId: 'res_older',
            saleId: 'sale_sneaker_001',
            userToken: 'usr_tok_456',
            status: 'RESERVED',
            updatedAt: '2026-05-05T10:00:00.000Z'
          },
          {
            reservationId: 'res_newer',
            saleId: 'sale_jacket_002',
            userToken: 'usr_tok_123',
            status: 'PURCHASED',
            updatedAt: '2026-05-05T10:05:00.000Z'
          }
        ]
      }),
      manualWorker: {}
    });

    expect(snapshot.dynamodb.shopperRecords.map((record) => record.reservationId)).toEqual([
      'res_newer',
      'res_older'
    ]);
    expect(snapshot.pipeline.find((stage) => stage.stage === 'dynamodb')?.summary).toBe('2 durable record(s)');
  });

  it('reads all durable rows newest-first even when a shopper token is present', async () => {
    send.mockResolvedValue({
      Items: [
        {
          reservationId: 'res_missing_updated_at',
          saleId: 'sale_hat_003',
          userToken: 'usr_tok_789',
          status: 'EXPIRED'
        },
        {
          reservationId: 'res_older',
          saleId: 'sale_sneaker_001',
          userToken: 'usr_tok_456',
          status: 'RESERVED',
          updatedAt: '2026-05-05T10:00:00.000Z'
        },
        {
          reservationId: 'res_newer',
          saleId: 'sale_jacket_002',
          userToken: 'usr_tok_123',
          status: 'PURCHASED',
          updatedAt: '2026-05-05T10:05:00.000Z'
        }
      ]
    });

    const snapshot = await readDynamoObservability({ userToken: 'usr_tok_123' });

    expect(snapshot.status).toBe('ok');
    expect(snapshot.tableName).toBe('flash-sale-reservations-local');
    expect(snapshot.shopperRecords).toHaveLength(3);
    expect(snapshot.shopperRecords.map((record) => record.reservationId)).toEqual([
      'res_newer',
      'res_older',
      'res_missing_updated_at'
    ]);
    expect(snapshot.shopperRecords).toEqual([
      expect.objectContaining({
        reservationId: 'res_newer',
        saleId: 'sale_jacket_002',
        userToken: 'usr_tok_123',
        status: 'PURCHASED',
        updatedAt: '2026-05-05T10:05:00.000Z'
      }),
      expect.objectContaining({
        reservationId: 'res_older',
        saleId: 'sale_sneaker_001',
        userToken: 'usr_tok_456',
        status: 'RESERVED',
        updatedAt: '2026-05-05T10:00:00.000Z'
      }),
      expect.objectContaining({
        reservationId: 'res_missing_updated_at',
        saleId: 'sale_hat_003',
        userToken: 'usr_tok_789',
        status: 'EXPIRED',
        updatedAt: undefined
      })
    ]);
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('ignores stale reservation ids whose redis hash is already gone', async () => {
    const redis = {
      smembers: vi.fn().mockResolvedValue(['res_stale']),
      hgetall: vi.fn().mockResolvedValue({}),
      get: vi.fn().mockResolvedValue('9'),
      zcard: vi.fn().mockResolvedValue(1)
    };

    await expect(
      readRedisObservability(redis as never, {
        userToken: 'usr_tok_123',
        saleIds: ['sale_founder_001']
      })
    ).resolves.toEqual({
      status: 'ok',
      stockBySale: [{ saleId: 'sale_founder_001', stock: 9 }],
      userReservationIds: ['res_stale'],
      reservations: [],
      expiryQueues: [{ saleId: 'sale_founder_001', size: 1 }]
    });
  });

  it('ignores reservation rows whose expiresAt is a finite but invalid date', async () => {
    const redis = {
      smembers: vi.fn().mockResolvedValue(['res_bad_expires_at']),
      hgetall: vi.fn().mockResolvedValue({
        saleId: 'sale_founder_001',
        userToken: 'usr_tok_123',
        status: 'RESERVED',
        expiresAt: '8640000000000001'
      }),
      get: vi.fn().mockResolvedValue('9'),
      zcard: vi.fn().mockResolvedValue(1)
    };

    await expect(
      readRedisObservability(redis as never, {
        userToken: 'usr_tok_123',
        saleIds: ['sale_founder_001']
      })
    ).resolves.toEqual({
      status: 'ok',
      stockBySale: [{ saleId: 'sale_founder_001', stock: 9 }],
      userReservationIds: ['res_bad_expires_at'],
      reservations: [],
      expiryQueues: [{ saleId: 'sale_founder_001', size: 1 }]
    });
  });
});
