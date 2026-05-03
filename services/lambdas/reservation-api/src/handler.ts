import type Redis from 'ioredis';
import { redisKeys } from '../../shared/src/redisKeys';
import { publishEvent } from '../../shared/src/events/publishEvent';
import type { ReservationEngine } from '../../shared/src/reservation/ReservationEngine';

export async function reserveSale(
  engine: ReservationEngine,
  input: {
    saleId: string;
    userToken: string;
    ttlSeconds: number;
    now: string;
    idempotencyKey?: string;
  }
) {
  const result = await engine.reserve(input);

  if (result.status === 'RESERVED' && result.shouldPublishEvent !== false) {
    await publishEvent('reservation-created', {
      eventId: input.idempotencyKey ?? result.reservationId,
      reservationId: result.reservationId,
      saleId: input.saleId,
      userToken: input.userToken,
      expiresAt: result.expiresAt
    });
  }

  if (result.status === 'RESERVED') {
    const { shouldPublishEvent: _shouldPublishEvent, ...response } = result;
    return response;
  }

  return result;
}

export async function listReservationsForUser(redis: Redis, userToken: string) {
  const reservationIds = await redis.smembers(redisKeys.userReservations(userToken));
  const reservations = await Promise.all(
    reservationIds.map((reservationId) => getReservationById(redis, reservationId))
  );

  return {
    items: reservations.filter(
      (reservation): reservation is NonNullable<typeof reservation> =>
        Boolean(reservation && reservation.status === 'RESERVED')
    )
  };
}

export async function getReservationById(redis: Redis, reservationId: string) {
  const payload = await redis.hgetall(redisKeys.reservation(reservationId));

  if (Object.keys(payload).length === 0) {
    return null;
  }

  return {
    reservationId,
    saleId: payload.saleId,
    userToken: payload.userToken,
    status: payload.status,
    expiresAt: new Date(Number(payload.expiresAt)).toISOString()
  };
}