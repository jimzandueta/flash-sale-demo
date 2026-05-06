import { readFileSync } from 'node:fs';
import type Redis from 'ioredis';
import { listSeedSales } from '../repositories/SalesRepository';
import { redisKeys } from '../redisKeys';

const releaseExpiredReservationScript = readFileSync(
  new URL('./releaseExpiredReservation.lua', import.meta.url),
  'utf8'
);

export type ExpiredReservationReleaseResult = {
  status: 'RELEASED' | 'NOT_EXPIRED' | 'SKIPPED' | 'NOT_FOUND';
  saleId?: string;
  userToken?: string;
  expiresAt?: string;
};

export type ReleasedReservationDetails = {
  reservationId: string;
  saleId: string;
  userToken: string;
  expiresAt: string;
};

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

  return {
    status: result[0] as ExpiredReservationReleaseResult['status'],
    saleId: result[1],
    userToken: result[2],
    expiresAt: result[3] ? new Date(Number(result[3])).toISOString() : undefined
  } satisfies ExpiredReservationReleaseResult;
}

export async function releaseDueReservations(
  redis: Pick<Redis, 'eval' | 'zrangebyscore'>,
  nowIso: string
) {
  const nowMs = Date.parse(nowIso);
  const released: ReleasedReservationDetails[] = [];

  for (const sale of listSeedSales()) {
    const dueReservationIds = await redis.zrangebyscore(redisKeys.expiries(sale.saleId), 0, nowMs);

    for (const reservationId of dueReservationIds) {
      const result = await reconcileExpiredReservation(redis, sale.saleId, reservationId, nowIso);

      if (
        result.status === 'RELEASED' &&
        result.saleId &&
        result.userToken &&
        result.expiresAt
      ) {
        released.push({
          reservationId,
          saleId: result.saleId,
          userToken: result.userToken,
          expiresAt: result.expiresAt
        });
      }
    }
  }

  return released;
}
