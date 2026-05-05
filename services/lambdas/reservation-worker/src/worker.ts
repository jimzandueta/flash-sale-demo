import { logger } from '../../shared/src/logger';
import { putReservationRecord } from '../../shared/src/repositories/ReservationsRepository';

export async function handleReservationCreated(event: {
  eventId: string;
  reservationId: string;
  saleId: string;
  userToken: string;
  expiresAt: string;
}) {
  logger.debug('reservation-worker persisting', event);

  await putReservationRecord(event);

  return { persisted: true };
}