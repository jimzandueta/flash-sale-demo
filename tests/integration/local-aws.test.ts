import { beforeEach, describe, expect, it } from 'vitest';
import {
  getReservationRecord,
  resetReservationsTable
} from './helpers/localAws';
import { putReservationRecord } from '../../services/lambdas/shared/src/repositories/ReservationsRepository';

describe('localAws resetReservationsTable', () => {
  const tableName = 'flash-sale-reservations-local';

  beforeEach(() => {
    process.env.AWS_REGION = 'us-east-1';
    process.env.AWS_ACCESS_KEY_ID = 'test';
    process.env.AWS_SECRET_ACCESS_KEY = 'test';
    process.env.DYNAMO_ENDPOINT = 'http://127.0.0.1:8000';
    process.env.RESERVATIONS_TABLE = tableName;
  });

  it('recreates the reservations table reliably across repeated resets', async () => {
    await resetReservationsTable(tableName);
    await resetReservationsTable(tableName);

    await putReservationRecord({
      eventType: 'reservation-created',
      eventId: 'evt_reset_recreate',
      occurredAt: '2026-05-05T05:10:00.000Z',
      reservationId: 'res_after_reset',
      saleId: 'sale_sneaker_001',
      userToken: 'usr_tok_1',
      expiresAt: '2026-05-05T05:15:00.000Z'
    });

    expect(await getReservationRecord(tableName, 'res_after_reset')).toMatchObject({
      reservationId: 'res_after_reset',
      status: 'RESERVED',
      reservationEventId: 'evt_reset_recreate'
    });
  });
});
