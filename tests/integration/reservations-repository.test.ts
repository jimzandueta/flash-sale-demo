import { beforeEach, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { getReservationRecord, resetReservationsTable } from './helpers/localAws';
import {
  putCancellationRecord,
  putExpiryRecord,
  putPurchaseRecord,
  putReservationRecord
} from '../../services/lambdas/shared/src/repositories/ReservationsRepository';

describe('ReservationsRepository', () => {
  const tableName = `flash-sale-reservations-local-${randomUUID()}`;

  beforeEach(async () => {
    process.env.AWS_REGION = 'us-east-1';
    process.env.AWS_ACCESS_KEY_ID = 'test';
    process.env.AWS_SECRET_ACCESS_KEY = 'test';
    process.env.DYNAMO_ENDPOINT = 'http://127.0.0.1:8000';
    process.env.RESERVATIONS_TABLE = tableName;

    await resetReservationsTable(tableName);
  });

  it('persists a reservation-created durable record', async () => {
    await putReservationRecord({
      eventType: 'reservation-created',
      eventId: 'evt_res_1',
      occurredAt: '2026-05-05T05:10:00.000Z',
      reservationId: 'res_123',
      saleId: 'sale_sneaker_001',
      userToken: 'usr_tok_1',
      expiresAt: '2026-05-05T05:15:00.000Z'
    });

    expect(await getReservationRecord(tableName, 'res_123')).toMatchObject({
      reservationId: 'res_123',
      saleId: 'sale_sneaker_001',
      userToken: 'usr_tok_1',
      status: 'RESERVED',
      reservationEventId: 'evt_res_1'
    });
  });

  it('updates a record to PURCHASED idempotently', async () => {
    await putReservationRecord({
      eventType: 'reservation-created',
      eventId: 'evt_res_2',
      occurredAt: '2026-05-05T05:10:00.000Z',
      reservationId: 'res_456',
      saleId: 'sale_sneaker_001',
      userToken: 'usr_tok_1',
      expiresAt: '2026-05-05T05:15:00.000Z'
    });

    const purchaseEvent = {
      eventType: 'purchase-completed' as const,
      eventId: 'evt_purchase_1',
      occurredAt: '2026-05-05T05:12:00.000Z',
      reservationId: 'res_456',
      saleId: 'sale_sneaker_001',
      userToken: 'usr_tok_1',
      purchasedAt: '2026-05-05T05:12:00.000Z'
    };

    await putPurchaseRecord(purchaseEvent);
    await putPurchaseRecord(purchaseEvent);

    expect(await getReservationRecord(tableName, 'res_456')).toMatchObject({
      reservationId: 'res_456',
      status: 'PURCHASED',
      purchaseEventId: 'evt_purchase_1',
      purchasedAt: '2026-05-05T05:12:00.000Z'
    });
  });

  it('does not downgrade a PURCHASED record when an expiry event arrives later', async () => {
    await putReservationRecord({
      eventType: 'reservation-created',
      eventId: 'evt_res_purchase_first',
      occurredAt: '2026-05-05T05:10:00.000Z',
      reservationId: 'res_purchase_first',
      saleId: 'sale_sneaker_001',
      userToken: 'usr_tok_1',
      expiresAt: '2026-05-05T05:15:00.000Z'
    });

    await putPurchaseRecord({
      eventType: 'purchase-completed',
      eventId: 'evt_purchase_terminal',
      occurredAt: '2026-05-05T05:12:00.000Z',
      reservationId: 'res_purchase_first',
      saleId: 'sale_sneaker_001',
      userToken: 'usr_tok_1',
      purchasedAt: '2026-05-05T05:12:00.000Z'
    });

    await putExpiryRecord({
      eventType: 'reservation-expired',
      eventId: 'expiry:res_purchase_first:v2',
      occurredAt: '2026-05-05T05:16:00.000Z',
      reservationId: 'res_purchase_first',
      saleId: 'sale_sneaker_001',
      userToken: 'usr_tok_1',
      expiresAt: '2026-05-05T05:15:00.000Z'
    });

    expect(await getReservationRecord(tableName, 'res_purchase_first')).toMatchObject({
      reservationId: 'res_purchase_first',
      status: 'PURCHASED',
      purchaseEventId: 'evt_purchase_terminal'
    });
  });

  it('does not downgrade a PURCHASED record when the reservation-created event replays later', async () => {
    const reservationEvent = {
      eventType: 'reservation-created' as const,
      eventId: 'evt_res_4',
      occurredAt: '2026-05-05T05:10:00.000Z',
      reservationId: 'res_keep_purchase',
      saleId: 'sale_sneaker_001',
      userToken: 'usr_tok_1',
      expiresAt: '2026-05-05T05:15:00.000Z'
    };

    await putReservationRecord(reservationEvent);
    await putPurchaseRecord({
      eventType: 'purchase-completed',
      eventId: 'evt_purchase_2',
      occurredAt: '2026-05-05T05:12:00.000Z',
      reservationId: 'res_keep_purchase',
      saleId: 'sale_sneaker_001',
      userToken: 'usr_tok_1',
      purchasedAt: '2026-05-05T05:12:00.000Z'
    });
    await putReservationRecord(reservationEvent);

    expect(await getReservationRecord(tableName, 'res_keep_purchase')).toMatchObject({
      reservationId: 'res_keep_purchase',
      status: 'PURCHASED',
      reservationEventId: 'evt_res_4',
      purchaseEventId: 'evt_purchase_2'
    });
  });

  it('updates a record to CANCELLED idempotently', async () => {
    await putReservationRecord({
      eventType: 'reservation-created',
      eventId: 'evt_res_cancel_1',
      occurredAt: '2026-05-05T05:10:00.000Z',
      reservationId: 'res_cancel_1',
      saleId: 'sale_sneaker_001',
      userToken: 'usr_tok_1',
      expiresAt: '2026-05-05T05:15:00.000Z'
    });

    const cancelEvent = {
      eventType: 'reservation-cancelled' as const,
      eventId: 'evt_cancel_1',
      occurredAt: '2026-05-05T05:11:00.000Z',
      reservationId: 'res_cancel_1',
      saleId: 'sale_sneaker_001',
      userToken: 'usr_tok_1'
    };

    await putCancellationRecord(cancelEvent);
    await putCancellationRecord(cancelEvent);

    expect(await getReservationRecord(tableName, 'res_cancel_1')).toMatchObject({
      reservationId: 'res_cancel_1',
      status: 'CANCELLED',
      cancellationEventId: 'evt_cancel_1',
      updatedAt: '2026-05-05T05:11:00.000Z'
    });
  });

  it('updates a record to EXPIRED idempotently', async () => {
    await putReservationRecord({
      eventType: 'reservation-created',
      eventId: 'evt_res_3',
      occurredAt: '2026-05-05T05:10:00.000Z',
      reservationId: 'res_789',
      saleId: 'sale_sneaker_001',
      userToken: 'usr_tok_1',
      expiresAt: '2026-05-05T05:15:00.000Z'
    });

    const expiryEvent = {
      eventType: 'reservation-expired' as const,
      eventId: 'expiry:res_789',
      occurredAt: '2026-05-05T05:16:00.000Z',
      reservationId: 'res_789',
      saleId: 'sale_sneaker_001',
      userToken: 'usr_tok_1',
      expiresAt: '2026-05-05T05:15:00.000Z'
    };

    await putExpiryRecord(expiryEvent);
    await putExpiryRecord(expiryEvent);

    expect(await getReservationRecord(tableName, 'res_789')).toMatchObject({
      reservationId: 'res_789',
      status: 'EXPIRED',
      expiryEventId: 'expiry:res_789'
    });
  });

  it('does not overwrite an EXPIRED record when a purchase event arrives later', async () => {
    await putReservationRecord({
      eventType: 'reservation-created',
      eventId: 'evt_res_expiry_first',
      occurredAt: '2026-05-05T05:10:00.000Z',
      reservationId: 'res_expiry_first',
      saleId: 'sale_sneaker_001',
      userToken: 'usr_tok_1',
      expiresAt: '2026-05-05T05:15:00.000Z'
    });

    await putExpiryRecord({
      eventType: 'reservation-expired',
      eventId: 'expiry:res_expiry_first',
      occurredAt: '2026-05-05T05:16:00.000Z',
      reservationId: 'res_expiry_first',
      saleId: 'sale_sneaker_001',
      userToken: 'usr_tok_1',
      expiresAt: '2026-05-05T05:15:00.000Z'
    });

    await putPurchaseRecord({
      eventType: 'purchase-completed',
      eventId: 'evt_purchase_after_expiry',
      occurredAt: '2026-05-05T05:17:00.000Z',
      reservationId: 'res_expiry_first',
      saleId: 'sale_sneaker_001',
      userToken: 'usr_tok_1',
      purchasedAt: '2026-05-05T05:17:00.000Z'
    });

    expect(await getReservationRecord(tableName, 'res_expiry_first')).toMatchObject({
      reservationId: 'res_expiry_first',
      status: 'EXPIRED',
      expiryEventId: 'expiry:res_expiry_first'
    });
  });

  it('does not downgrade a PURCHASED record when a cancellation event arrives later', async () => {
    await putReservationRecord({
      eventType: 'reservation-created',
      eventId: 'evt_res_cancel_after_purchase',
      occurredAt: '2026-05-05T05:10:00.000Z',
      reservationId: 'res_cancel_after_purchase',
      saleId: 'sale_sneaker_001',
      userToken: 'usr_tok_1',
      expiresAt: '2026-05-05T05:15:00.000Z'
    });

    await putPurchaseRecord({
      eventType: 'purchase-completed',
      eventId: 'evt_purchase_first',
      occurredAt: '2026-05-05T05:12:00.000Z',
      reservationId: 'res_cancel_after_purchase',
      saleId: 'sale_sneaker_001',
      userToken: 'usr_tok_1',
      purchasedAt: '2026-05-05T05:12:00.000Z'
    });

    await putCancellationRecord({
      eventType: 'reservation-cancelled',
      eventId: 'evt_cancel_late',
      occurredAt: '2026-05-05T05:13:00.000Z',
      reservationId: 'res_cancel_after_purchase',
      saleId: 'sale_sneaker_001',
      userToken: 'usr_tok_1'
    });

    expect(await getReservationRecord(tableName, 'res_cancel_after_purchase')).toMatchObject({
      reservationId: 'res_cancel_after_purchase',
      status: 'PURCHASED',
      purchaseEventId: 'evt_purchase_first'
    });
  });
});
