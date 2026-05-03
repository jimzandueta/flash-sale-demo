import Fastify from 'fastify';
import { reserveSale } from '../../reservation-api/src/handler';
import { listSales } from '../../sales-api/src/handler';
import { createSession } from '../../session-api/src/handler';
import { createRedisClient } from '../../shared/src/redisClient';
import { redisKeys } from '../../shared/src/redisKeys';
import { logger } from '../../shared/src/logger';
import { RedisReservationEngine } from '../../shared/src/reservation/RedisReservationEngine';

export async function buildServer() {
  const app = Fastify();
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
    const headers = request.headers as { 'x-user-token'?: string };
    const params = request.params as { saleId: string };

    if (!saleStocks.has(params.saleId)) {
      return reply.code(404).send({ status: 'SALE_NOT_FOUND' });
    }

    const result = await reserveSale(reservationEngine, {
      saleId: params.saleId,
      userToken: headers['x-user-token'] ?? 'missing',
      ttlSeconds: 300,
      now: new Date().toISOString(),
      idempotencyKey: String(headers['idempotency-key'] ?? 'missing')
    });

    logger.debug('reservation spike result', result);

    return result;
  });

  return app;
}