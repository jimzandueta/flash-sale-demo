import Fastify from 'fastify';
import { listSales } from '../../sales-api/src/handler';
import { createSession } from '../../session-api/src/handler';
import { logger } from '../../shared/src/logger';

export async function buildServer() {
  const app = Fastify();

  app.post('/sessions', async (request) => {
    const body = (request.body ?? {}) as { displayName: string };

    logger.debug('creating anonymous session', body);

    return createSession(body);
  });

  app.get('/sales', async () => {
    logger.debug('listing sales');

    return listSales();
  });

  return app;
}