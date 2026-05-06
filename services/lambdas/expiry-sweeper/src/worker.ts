import { createRedisClient } from '../../shared/src/redisClient';
import { publishEvent } from '../../shared/src/events/publishEvent';
import { logger } from '../../shared/src/logger';
import { releaseDueReservations } from '../../shared/src/reservation/releaseExpiredReservations';

export async function releaseExpiredReservations(nowIso: string) {
  logger.debug('expiry-sweeper running at', nowIso);

  const redis = createRedisClient();

  try {
    const released = await releaseDueReservations(redis, nowIso);

    for (const reservation of released) {
      await publishEvent('reservation-expired', {
        eventId: `expiry:${reservation.reservationId}`,
        occurredAt: nowIso,
        reservationId: reservation.reservationId,
        saleId: reservation.saleId,
        userToken: reservation.userToken,
        expiresAt: reservation.expiresAt
      });
    }

    return released.length;
  } finally {
    await redis.quit();
  }
}
