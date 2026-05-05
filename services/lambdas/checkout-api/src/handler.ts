import type Redis from 'ioredis';
import { readFileSync } from 'node:fs';
import { publishEvent } from '../../shared/src/events/publishEvent';
import { redisKeys } from '../../shared/src/redisKeys';

const checkoutScript = readFileSync(
  new URL('../../shared/src/reservation/checkoutReservation.lua', import.meta.url),
  'utf8'
);

export async function checkoutReservation(
  redis: Pick<Redis, 'eval'>,
  input: {
    reservationId: string;
    userToken: string;
    simulateFailure: boolean;
    now?: string;
  }
) {
  const nowIso = input.now ?? new Date().toISOString();
  const result = (await redis.eval(
    checkoutScript,
    1,
    redisKeys.reservation(input.reservationId),
    input.userToken,
    input.reservationId,
    String(Date.parse(nowIso)),
    nowIso,
    input.simulateFailure ? '1' : '0'
  )) as string[];

  if (result[0] === 'PAYMENT_FAILED') {
    return {
      status: 'PAYMENT_FAILED',
      reservationId: input.reservationId
    };
  }

  if (result[0] === 'RESERVATION_EXPIRED') {
    return {
      status: 'RESERVATION_EXPIRED',
      reservationId: input.reservationId
    };
  }

  await publishEvent('purchase-completed', {
    reservationId: input.reservationId,
    userToken: input.userToken,
    status: 'PURCHASED',
    purchasedAt: result[1]
  });

  return {
    status: 'PURCHASED',
    reservationId: input.reservationId,
    purchasedAt: result[1]
  };
}
