import { publishEvent } from '../../shared/src/events/publishEvent';
import type { ReservationEngine } from '../../shared/src/reservation/ReservationEngine';

export async function reserveSale(
  engine: ReservationEngine,
  input: {
    saleId: string;
    userToken: string;
    ttlSeconds: number;
    now: string;
    idempotencyKey: string;
  }
) {
  const result = await engine.reserve(input);

  if (result.status === 'RESERVED') {
    await publishEvent('reservation-created', {
      eventId: input.idempotencyKey,
      reservationId: result.reservationId,
      saleId: input.saleId,
      userToken: input.userToken,
      expiresAt: result.expiresAt
    });
  }

  return result;
}