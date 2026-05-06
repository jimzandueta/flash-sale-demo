import { beforeEach, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { getReservationRecord, resetReservationsTable } from './helpers/localAws';
import {
  handleDurableEvent,
  handleWorkerMessage
} from '../../services/lambdas/reservation-worker/src/worker';

describe('reservation worker', () => {
  const tableName = `flash-sale-reservations-local-${randomUUID()}`;

  beforeEach(async () => {
    process.env.AWS_REGION = 'us-east-1';
    process.env.AWS_ACCESS_KEY_ID = 'test';
    process.env.AWS_SECRET_ACCESS_KEY = 'test';
    process.env.DYNAMO_ENDPOINT = 'http://127.0.0.1:8000';
    process.env.RESERVATIONS_TABLE = tableName;

    await resetReservationsTable(tableName);
  });

  it('persists reservation-created and purchase-completed events through dispatcher', async () => {
    const reservationResult = await handleDurableEvent({
      eventType: 'reservation-created',
      eventId: 'evt_1',
      occurredAt: '2026-05-05T05:10:00.000Z',
      reservationId: 'res_123',
      saleId: 'sale_sneaker_001',
      userToken: 'usr_tok_1',
      expiresAt: '2026-05-06T10:05:00Z'
    });

    const purchaseResult = await handleWorkerMessage(
      JSON.stringify({
        eventType: 'purchase-completed',
        eventId: 'evt_2',
        occurredAt: '2026-05-05T05:20:00.000Z',
        reservationId: 'res_123',
        saleId: 'sale_sneaker_001',
        userToken: 'usr_tok_1',
        purchasedAt: '2026-05-05T05:20:00.000Z'
      })
    );

    expect(reservationResult.persisted).toBe(true);
    expect(purchaseResult.persisted).toBe(true);
    expect(await getReservationRecord(tableName, 'res_123')).toMatchObject({
      reservationId: 'res_123',
      reservationEventId: 'evt_1',
      purchaseEventId: 'evt_2',
      status: 'PURCHASED',
      updatedAt: '2026-05-05T05:20:00.000Z'
    });
  });

  it('applies duplicate reservation-created event safely', async () => {
    const event = {
      eventType: 'reservation-created' as const,
      eventId: 'evt_duplicate',
      occurredAt: '2026-05-05T05:10:00.000Z',
      reservationId: 'res_456',
      saleId: 'sale_sneaker_002',
      userToken: 'usr_tok_2',
      expiresAt: '2026-05-06T10:05:00Z'
    };

    const firstResult = await handleDurableEvent(event);
    const secondResult = await handleDurableEvent(event);

    expect(firstResult.persisted).toBe(true);
    expect(secondResult.persisted).toBe(true);
    expect(await getReservationRecord(tableName, 'res_456')).toMatchObject({
      reservationId: 'res_456',
      reservationEventId: 'evt_duplicate',
      status: 'RESERVED',
      updatedAt: '2026-05-05T05:10:00.000Z'
    });
  });

  it('persists reservation-expired events through the dispatcher', async () => {
    const reservationId = 'res_expired';

    await handleDurableEvent({
      eventType: 'reservation-created',
      eventId: 'evt_expired_create',
      occurredAt: '2026-05-05T05:10:00.000Z',
      reservationId,
      saleId: 'sale_sneaker_003',
      userToken: 'usr_tok_3',
      expiresAt: '2026-05-05T05:15:00.000Z'
    });

    const expiryResult = await handleWorkerMessage(
      JSON.stringify({
        eventType: 'reservation-expired',
        eventId: 'evt_expired_1',
        occurredAt: '2026-05-05T05:16:00.000Z',
        reservationId,
        saleId: 'sale_sneaker_003',
        userToken: 'usr_tok_3',
        expiresAt: '2026-05-05T05:15:00.000Z'
      })
    );

    expect(expiryResult.persisted).toBe(true);
    expect(await getReservationRecord(tableName, reservationId)).toMatchObject({
      reservationId,
      status: 'EXPIRED',
      expiryEventId: 'evt_expired_1',
      updatedAt: '2026-05-05T05:16:00.000Z'
    });
  });

  it('persists reservation-cancelled events through the dispatcher', async () => {
    const reservationId = 'res_cancel_worker';

    await handleDurableEvent({
      eventType: 'reservation-created',
      eventId: 'evt_cancel_create',
      occurredAt: '2026-05-05T05:10:00.000Z',
      reservationId,
      saleId: 'sale_sneaker_003',
      userToken: 'usr_tok_3',
      expiresAt: '2026-05-05T05:15:00.000Z'
    });

    const cancelResult = await handleWorkerMessage(
      JSON.stringify({
        eventType: 'reservation-cancelled',
        eventId: 'evt_cancel_worker_1',
        occurredAt: '2026-05-05T05:11:00.000Z',
        reservationId,
        saleId: 'sale_sneaker_003',
        userToken: 'usr_tok_3'
      })
    );

    expect(cancelResult.persisted).toBe(true);
    expect(await getReservationRecord(tableName, reservationId)).toMatchObject({
      reservationId,
      status: 'CANCELLED',
      cancellationEventId: 'evt_cancel_worker_1',
      updatedAt: '2026-05-05T05:11:00.000Z'
    });
  });

  it('does not downgrade a PURCHASED reservation when a cancellation worker message arrives later', async () => {
    const reservationId = 'res_cancel_after_purchase_worker';

    await handleDurableEvent({
      eventType: 'reservation-created',
      eventId: 'evt_cancel_after_purchase_create',
      occurredAt: '2026-05-05T05:10:00.000Z',
      reservationId,
      saleId: 'sale_sneaker_004',
      userToken: 'usr_tok_4',
      expiresAt: '2026-05-05T05:15:00.000Z'
    });

    await handleWorkerMessage(
      JSON.stringify({
        eventType: 'purchase-completed',
        eventId: 'evt_cancel_after_purchase_complete',
        occurredAt: '2026-05-05T05:12:00.000Z',
        reservationId,
        saleId: 'sale_sneaker_004',
        userToken: 'usr_tok_4',
        purchasedAt: '2026-05-05T05:12:00.000Z'
      })
    );

    const cancelResult = await handleWorkerMessage(
      JSON.stringify({
        eventType: 'reservation-cancelled',
        eventId: 'evt_cancel_after_purchase_cancel',
        occurredAt: '2026-05-05T05:13:00.000Z',
        reservationId,
        saleId: 'sale_sneaker_004',
        userToken: 'usr_tok_4'
      })
    );

    expect(cancelResult.persisted).toBe(false);
    expect(await getReservationRecord(tableName, reservationId)).toMatchObject({
      reservationId,
      status: 'PURCHASED',
      purchaseEventId: 'evt_cancel_after_purchase_complete'
    });
  });

  it('throws when a worker message has an unsupported event type', async () => {
    await expect(
      handleWorkerMessage(
        JSON.stringify({
          eventType: 'unsupported-event',
          eventId: 'evt_invalid',
          occurredAt: '2026-05-05T05:25:00.000Z',
          reservationId: 'res_invalid'
        })
      )
    ).rejects.toThrow('Unhandled durable event type: unsupported-event');
  });
});
