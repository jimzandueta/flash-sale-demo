import Fastify from 'fastify';
import { createSession } from '../../session-api/src/handler';
import { logger } from '../../shared/src/logger';

export async function buildServer() {
  const app = Fastify();

  app.post('/sessions', async (request) => {
    const body = (request.body ?? {}) as { displayName: string };

    logger.debug('creating anonymous session', body);

    return createSession(body);
  });

  return app;
}