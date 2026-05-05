import { readFileSync } from 'node:fs';
import type Redis from 'ioredis';
import { listSeedSales } from '../repositories/SalesRepository';
import { redisKeys } from '../redisKeys';

const releaseExpiredReservationScript = readFileSync(
  new URL('./releaseExpiredReservation.lua', import.meta.url),
  'utf8'
);

export async function reconcileExpiredReservation(
  redis: Pick<Redis, 'eval'>,
  saleId: string,
  reservationId: string,
  nowIso: string
) {
  const result = (await redis.eval(
    releaseExpiredReservationScript,
    2,
    redisKeys.reservation(reservationId),
    redisKeys.expiries(saleId),
    reservationId,
    String(Date.parse(nowIso))
  )) as string[];

  return result[0] as 'RELEASED' | 'NOT_EXPIRED' | 'SKIPPED' | 'NOT_FOUND';
}

export async function releaseDueReservations(
  redis: Pick<Redis, 'eval' | 'zrangebyscore'>,
  nowIso: string
) {
  const nowMs = Date.parse(nowIso);
  let released = 0;

  for (const sale of listSeedSales()) {
    const dueReservationIds = await redis.zrangebyscore(redisKeys.expiries(sale.saleId), 0, nowMs);

    for (const reservationId of dueReservationIds) {
      if ((await reconcileExpiredReservation(redis, sale.saleId, reservationId, nowIso)) === 'RELEASED') {
        released += 1;
      }
    }
  }

  return released;
}
