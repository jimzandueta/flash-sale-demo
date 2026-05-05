import { createDynamoClient } from '../dynamoClient';
import { logger } from '../logger';

export async function putReservationRecord(event: {
  reservationId: string;
  saleId: string;
  userToken: string;
  expiresAt: string;
}) {
  const dynamo = createDynamoClient();

  logger.debug('ReservationsRepository put', event, dynamo);

  return { ok: true };
}