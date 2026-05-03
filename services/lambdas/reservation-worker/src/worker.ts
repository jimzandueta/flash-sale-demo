import { putReservationRecord } from '../../shared/src/repositories/ReservationsRepository';

export async function handleReservationCreated(event: {
  eventId: string;
  reservationId: string;
  saleId: string;
  userToken: string;
  expiresAt: string;
}) {
  console.log('[reservation-worker] persisting', event);

  await putReservationRecord(event);

  return { persisted: true };
}