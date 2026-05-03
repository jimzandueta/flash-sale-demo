import { createDynamoClient } from '../dynamoClient';

export async function putReservationRecord(event: {
  reservationId: string;
  saleId: string;
  userToken: string;
  expiresAt: string;
}) {
  const dynamo = createDynamoClient();

  console.log('[ReservationsRepository] put', event, dynamo);

  return { ok: true };
}