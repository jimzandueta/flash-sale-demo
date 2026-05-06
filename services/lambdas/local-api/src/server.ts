import Fastify from 'fastify';
import { CreateTableCommand, DescribeTableCommand, waitUntilTableExists } from '@aws-sdk/client-dynamodb';
import { checkoutReservation } from '../../checkout-api/src/handler';
import { cancelReservation, getReservationById, listReservationsForUser, reserveSale } from '../../reservation-api/src/handler';
import { listSales } from '../../sales-api/src/handler';
import { createSession } from '../../session-api/src/handler';
import {
  buildObservabilitySnapshot,
  readDynamoObservability,
  readRedisObservability,
  readSqsObservability
} from './debug/observability';
import { processWorkerNow } from './debug/processWorker';
import { createRedisClient } from '../../shared/src/redisClient';
import { listSeedSales } from '../../shared/src/repositories/SalesRepository';
import { redisKeys } from '../../shared/src/redisKeys';
import { logger } from '../../shared/src/logger';
import { RedisReservationEngine } from '../../shared/src/reservation/RedisReservationEngine';
import { getAppConfig } from '../../shared/src/config';
import { createLocalDynamoClient } from '../../../../tests/integration/helpers/localAws';
import { resolveLocalWorkerMode } from '../../../docker/localWorkerMode';

function getUserToken(headers: { 'x-user-token'?: string }) {
  const userToken = headers['x-user-token'];

  if (typeof userToken !== 'string' || userToken.length === 0) {
    return null;
  }

  return userToken;
}

async function retryLocalDynamoBootstrap<T>(work: () => Promise<T>) {
  let lastError: unknown;

  for (let attempt = 0; attempt < 10; attempt += 1) {
    try {
      return await work();
    } catch (error) {
      lastError = error;

      if (!isRetryableLocalDynamoBootstrapError(error) || attempt === 9) {
        throw error;
      }

      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }

  throw lastError;
}

function isRetryableLocalDynamoBootstrapError(error: unknown) {
  const candidate = error as { code?: string; name?: string; message?: string };

  return (
    candidate?.code === 'ECONNREFUSED' ||
    candidate?.name === 'TimeoutError' ||
    candidate?.message?.includes('ECONNREFUSED') === true
  );
}

export async function buildServer() {
  const app = Fastify();
  const config = getAppConfig();
  const seededSales = listSeedSales();
  const salesById = new Map<string, (typeof seededSales)[number]>(
    seededSales.map((sale) => [sale.saleId, sale])
  );
  const saleStocks = new Map([
    ['sale_sneaker_001', 10],
    ['sale_jacket_002', 5]
  ]);
  let manualWorkerState: {
    lastRunAt?: string;
    lastResult?: {
      reservation: number;
      purchase: number;
      expiry: number;
    };
    lastError?: string;
  } = {};
  const redis = createRedisClient();
  const reservationEngine = new RedisReservationEngine(redis);

  await ensureReservationsTable(config.reservationsTable);

  await Promise.all(
    Array.from(saleStocks.entries(), ([saleId, stock]) => redis.set(redisKeys.stock(saleId), String(stock), 'NX'))
  );

  app.addHook('onClose', async () => {
    await redis.quit();
  });

  app.post('/sessions', async (request) => {
    const body = (request.body ?? {}) as { displayName: string };

    logger.debug('creating anonymous session', body);

    return createSession(body);
  });

  app.get('/sales', async () => {
    logger.debug('listing sales');

    return listSales({
      getRemainingStock: async (saleId) => {
        const raw = await redis.get(redisKeys.stock(saleId));
        return raw === null ? undefined : Number(raw);
      }
    });
  });

  app.post('/sales/:saleId/reservations', async (request, reply) => {
    const headers = request.headers as {
      'x-user-token'?: string;
      'idempotency-key'?: string;
    };
    const params = request.params as { saleId: string };
    const userToken = getUserToken(headers);
    const sale = salesById.get(params.saleId);

    if (!userToken) {
      return reply.code(401).send({ status: 'USER_TOKEN_REQUIRED' });
    }

    if (!sale) {
      return reply.code(404).send({ status: 'SALE_NOT_FOUND' });
    }

    if (sale.status !== 'active') {
      return reply.code(409).send({ status: 'SALE_NOT_ACTIVE' });
    }

    const result = await reserveSale(reservationEngine, {
      saleId: params.saleId,
      userToken,
      ttlSeconds: sale.reservationTtlSeconds,
      now: new Date().toISOString(),
      idempotencyKey: headers['idempotency-key']
    });

    logger.debug('reservation spike result', result);

    return result;
  });

  app.post('/reservations/:reservationId/checkout', async (request, reply) => {
    const params = request.params as { reservationId: string };
    const headers = request.headers as {
      'x-user-token'?: string;
      'idempotency-key'?: string;
    };
    const body = (request.body ?? {}) as { simulateFailure?: boolean };
    const userToken = getUserToken(headers);

    if (!userToken) {
      return reply.code(401).send({ status: 'USER_TOKEN_REQUIRED' });
    }

    return checkoutReservation(redis, {
      reservationId: params.reservationId,
      userToken,
      simulateFailure: body.simulateFailure ?? false,
      idempotencyKey: headers['idempotency-key']
    });
  });

  app.get('/reservations', async (request, reply) => {
    const headers = request.headers as { 'x-user-token'?: string };
    const userToken = getUserToken(headers);

    if (!userToken) {
      return reply.code(401).send({ status: 'USER_TOKEN_REQUIRED' });
    }

    return listReservationsForUser(redis, userToken);
  });

  app.get('/reservations/:reservationId', async (request, reply) => {
    const params = request.params as { reservationId: string };
    const headers = request.headers as { 'x-user-token'?: string };
    const userToken = getUserToken(headers);
    const reservation = await getReservationById(redis, params.reservationId);

    if (!userToken) {
      return reply.code(401).send({ status: 'USER_TOKEN_REQUIRED' });
    }

    if (!reservation || reservation.userToken !== userToken) {
      return reply.code(404).send({ status: 'RESERVATION_NOT_FOUND' });
    }

    return reservation;
  });

  app.delete('/reservations/:reservationId', async (request, reply) => {
    const params = request.params as { reservationId: string };
    const headers = request.headers as { 'x-user-token'?: string };
    const userToken = getUserToken(headers);

    if (!userToken) {
      return reply.code(401).send({ status: 'USER_TOKEN_REQUIRED' });
    }

    const result = await cancelReservation(redis, {
      reservationId: params.reservationId,
      userToken
    });

    if (result.status === 'FORBIDDEN') {
      return reply.code(403).send({ status: 'FORBIDDEN' });
    }

    if (result.status === 'NOT_FOUND') {
      return reply.code(404).send({ status: 'NOT_FOUND' });
    }

    return result;
  });

  app.get('/debug/observability', async (request) => {
    const query = (request.query ?? {}) as {
      userToken?: string;
      page?: string;
      cartCount?: string;
      purchaseCount?: string;
      activeSaleCount?: string;
      userLabel?: string;
    };

    return buildObservabilitySnapshot({
      workerMode: resolveLocalWorkerMode(),
      app: {
        page: query.page ?? 'unknown',
        cartCount: Number(query.cartCount ?? '0'),
        purchaseCount: Number(query.purchaseCount ?? '0'),
        activeSaleCount: Number(query.activeSaleCount ?? '0'),
        userLabel: query.userLabel ?? ''
      },
      shopper: {
        userToken: query.userToken,
        displayName: query.userLabel
      },
      readRedis: () =>
        readRedisObservability(redis, {
          userToken: query.userToken,
          saleIds: seededSales.map((sale) => sale.saleId)
        }),
      readSqs: () => readSqsObservability(),
      readDynamo: () =>
        readDynamoObservability({
          userToken: query.userToken
        }),
      manualWorker: manualWorkerState
    });
  });

  app.post('/debug/process-worker', async () => {
    try {
      const result = await processWorkerNow();
      manualWorkerState = {
        lastRunAt: result.processedAt,
        lastResult: result.processed,
        lastError: undefined
      };
      return result;
    } catch (error) {
      manualWorkerState = {
        ...manualWorkerState,
        lastError: error instanceof Error ? error.message : 'Worker processing failed'
      };
      throw error;
    }
  });

  return app;
}

async function ensureReservationsTable(tableName: string) {
  const dynamo = createLocalDynamoClient();

  await retryLocalDynamoBootstrap(async () => {
    try {
      await dynamo.send(new DescribeTableCommand({ TableName: tableName }));
      return;
    } catch (error) {
      if ((error as { name?: string }).name !== 'ResourceNotFoundException') {
        throw error;
      }
    }

    try {
      await dynamo.send(
        new CreateTableCommand({
          TableName: tableName,
          BillingMode: 'PAY_PER_REQUEST',
          KeySchema: [{ AttributeName: 'reservationId', KeyType: 'HASH' }],
          AttributeDefinitions: [{ AttributeName: 'reservationId', AttributeType: 'S' }]
        })
      );
    } catch (error) {
      if ((error as { name?: string }).name !== 'ResourceInUseException') {
        throw error;
      }
    }

    await waitUntilTableExists({ client: dynamo, maxWaitTime: 21 }, { TableName: tableName });
  });
}
