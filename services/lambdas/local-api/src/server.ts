import Fastify from 'fastify';
import { checkoutReservation } from '../../checkout-api/src/handler';
import { cancelReservation, getReservationById, listReservationsForUser, reserveSale } from '../../reservation-api/src/handler';
import { listSales } from '../../sales-api/src/handler';
import { createSession } from '../../session-api/src/handler';
import { createRedisClient } from '../../shared/src/redisClient';
import { listSeedSales } from '../../shared/src/repositories/SalesRepository';
import { redisKeys } from '../../shared/src/redisKeys';
import { logger } from '../../shared/src/logger';
import { RedisReservationEngine } from '../../shared/src/reservation/RedisReservationEngine';

function getUserToken(headers: { 'x-user-token'?: string }) {
  const userToken = headers['x-user-token'];

  if (typeof userToken !== 'string' || userToken.length === 0) {
    return null;
  }

  return userToken;
}

export async function buildServer() {
  const app = Fastify();
  const seededSales = listSeedSales();
  const salesById = new Map<string, (typeof seededSales)[number]>(
    seededSales.map((sale) => [sale.saleId, sale])
  );
  const saleStocks = new Map([
    ['sale_sneaker_001', 10],
    ['sale_jacket_002', 5]
  ]);
  const redis = createRedisClient();
  const reservationEngine = new RedisReservationEngine(redis);

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

    return listSales();
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
    const headers = request.headers as { 'x-user-token'?: string };
    const body = (request.body ?? {}) as { simulateFailure?: boolean };
    const userToken = getUserToken(headers);

    if (!userToken) {
      return reply.code(401).send({ status: 'USER_TOKEN_REQUIRED' });
    }

    return checkoutReservation({
      reservationId: params.reservationId,
      userToken,
      simulateFailure: body.simulateFailure ?? false
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

  return app;
}