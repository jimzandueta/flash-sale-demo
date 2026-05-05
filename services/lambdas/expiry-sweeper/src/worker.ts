import { createRedisClient } from '../../shared/src/redisClient';
import { logger } from '../../shared/src/logger';
import { releaseDueReservations } from '../../shared/src/reservation/releaseExpiredReservations';

export async function releaseExpiredReservations(nowIso: string) {
  logger.debug('expiry-sweeper running at', nowIso);

  const redis = createRedisClient();

  try {
    return await releaseDueReservations(redis, nowIso);
  } finally {
    await redis.quit();
  }
}
