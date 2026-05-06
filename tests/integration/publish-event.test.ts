import { beforeEach, describe, expect, it } from 'vitest';
import { publishEvent } from '../../services/lambdas/shared/src/events/publishEvent';
import { ensureQueue, receiveSingleMessage, uniqueQueueName } from './helpers/localAws';

describe('publishEvent', () => {
  let reservationQueueUrl = '';
  let purchaseQueueUrl = '';

  beforeEach(async () => {
    process.env.AWS_REGION = 'us-east-1';
    process.env.AWS_ACCESS_KEY_ID = 'test';
    process.env.AWS_SECRET_ACCESS_KEY = 'test';
    process.env.SQS_ENDPOINT = 'http://127.0.0.1:4566';

    reservationQueueUrl = await ensureQueue(uniqueQueueName('dev-reservation-events'));
    process.env.RESERVATION_EVENTS_QUEUE_URL = reservationQueueUrl;
    purchaseQueueUrl = await ensureQueue(uniqueQueueName('dev-purchase-events'));
    process.env.PURCHASE_EVENTS_QUEUE_URL = purchaseQueueUrl;
    process.env.EXPIRY_EVENTS_QUEUE_URL = await ensureQueue(uniqueQueueName('dev-expiry-events'));
  });

  it('sends a typed reservation-created message to the real queue', async () => {
    await publishEvent('reservation-created', {
      eventId: 'evt_publish_1',
      occurredAt: '2026-05-05T05:00:00.000Z',
      reservationId: 'res_123',
      saleId: 'sale_sneaker_001',
      userToken: 'usr_tok_1',
      expiresAt: '2026-05-05T05:05:00.000Z'
    });

    const message = await receiveSingleMessage(reservationQueueUrl);

    expect(message?.Body ? JSON.parse(message.Body) : null).toEqual({
      eventType: 'reservation-created',
      eventId: 'evt_publish_1',
      occurredAt: '2026-05-05T05:00:00.000Z',
      reservationId: 'res_123',
      saleId: 'sale_sneaker_001',
      userToken: 'usr_tok_1',
      expiresAt: '2026-05-05T05:05:00.000Z'
    });
  });

  it('normalizes legacy purchase-completed payloads before sending to the queue', async () => {
    await publishEvent('purchase-completed', {
      reservationId: 'res_456',
      userToken: 'usr_tok_2',
      status: 'PURCHASED',
      purchasedAt: '2026-05-06T10:02:10.000Z'
    });

    const message = await receiveSingleMessage(purchaseQueueUrl);

    expect(message?.Body ? JSON.parse(message.Body) : null).toEqual({
      eventType: 'purchase-completed',
      eventId: 'purchase-completed:res_456:2026-05-06T10:02:10.000Z',
      occurredAt: '2026-05-06T10:02:10.000Z',
      reservationId: 'res_456',
      saleId: 'unknown-sale',
      userToken: 'usr_tok_2',
      purchasedAt: '2026-05-06T10:02:10.000Z'
    });
  });
});
