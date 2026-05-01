import Fastify from 'fastify';
import { reserveSale } from '../../reservation-api/src/handler';
import { listSales } from '../../sales-api/src/handler';
import { createSession } from '../../session-api/src/handler';
import { createInMemoryReservationEngine } from '../../shared/src/reservation/InMemoryReservationEngine';
import { logger } from '../../shared/src/logger';

export async function buildServer() {
  const app = Fastify();
  const reservationEngines = new Map([
    ['sale_sneaker_001', createInMemoryReservationEngine({ saleId: 'sale_sneaker_001', stock: 10 })],
    ['sale_jacket_002', createInMemoryReservationEngine({ saleId: 'sale_jacket_002', stock: 5 })]
  ]);

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
    const engine = reservationEngines.get(params.saleId);

    if (!engine) {
      return reply.code(404).send({ status: 'SALE_NOT_FOUND' });
    }

    const result = await reserveSale(engine, {
      saleId: params.saleId,
      userToken: headers['x-user-token'] ?? 'missing',
      ttlSeconds: 300,
      now: new Date().toISOString()
    });

    logger.debug('reservation spike result', result);

    return result;
  });

  return app;
}