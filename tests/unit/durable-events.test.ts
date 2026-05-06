import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildDurableEvent, queueUrlForEventType } from '../../services/lambdas/shared/src/events/types';

describe('durable events', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('fills missing fields for legacy reservation-created payloads', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-05T05:00:00.000Z'));

    expect(
      buildDurableEvent('reservation-created', {
        eventId: 'evt_publish_1',
        reservationId: 'res_123',
        saleId: 'sale_sneaker_001',
        userToken: 'usr_tok_1',
        expiresAt: '2026-05-05T05:05:00.000Z'
      } as never)
    ).toEqual({
      eventType: 'reservation-created',
      eventId: 'evt_publish_1',
      occurredAt: '2026-05-05T05:00:00.000Z',
      reservationId: 'res_123',
      saleId: 'sale_sneaker_001',
      userToken: 'usr_tok_1',
      expiresAt: '2026-05-05T05:05:00.000Z'
    });
  });

  it('normalizes legacy purchase-completed payloads before publish', () => {
    expect(
      buildDurableEvent('purchase-completed', {
        reservationId: 'res_456',
        userToken: 'usr_tok_2',
        status: 'PURCHASED',
        purchasedAt: '2026-05-06T10:02:10.000Z'
      } as never)
    ).toEqual({
      eventType: 'purchase-completed',
      eventId: 'purchase-completed:res_456:2026-05-06T10:02:10.000Z',
      occurredAt: '2026-05-06T10:02:10.000Z',
      reservationId: 'res_456',
      saleId: 'unknown-sale',
      userToken: 'usr_tok_2',
      purchasedAt: '2026-05-06T10:02:10.000Z'
    });
  });

  it('throws when queue mapping is missing for an event type', () => {
    expect(() =>
      queueUrlForEventType(
        {
          reservationEventsQueueUrl: 'reservation-queue',
          purchaseEventsQueueUrl: 'purchase-queue',
          expiryEventsQueueUrl: 'expiry-queue'
        },
        'future-event' as never
      )
    ).toThrow('Unhandled durable event type: future-event');
  });
});
