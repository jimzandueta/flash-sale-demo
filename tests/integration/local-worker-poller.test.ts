import { SendMessageCommand } from '@aws-sdk/client-sqs';
import { beforeEach, describe, expect, it } from 'vitest';
import { publishEvent } from '../../services/lambdas/shared/src/events/publishEvent';
import { createSqsClient } from '../../services/lambdas/shared/src/sqsClient';
import { pollQueuesOnce } from '../../services/lambdas/reservation-worker/src/poller';
import {
  ensureQueue,
  getReservationRecord,
  receiveSingleMessage,
  resetReservationsTable,
  uniqueQueueName
} from './helpers/localAws';

describe('local worker poller', () => {
  const tableName = 'flash-sale-reservations-local';
  let reservationQueueUrl = '';
  let purchaseQueueUrl = '';
  let expiryQueueUrl = '';

  beforeEach(async () => {
    process.env.AWS_REGION = 'us-east-1';
    process.env.AWS_ACCESS_KEY_ID = 'test';
    process.env.AWS_SECRET_ACCESS_KEY = 'test';
    process.env.SQS_ENDPOINT = 'http://127.0.0.1:4566';
    process.env.DYNAMO_ENDPOINT = 'http://127.0.0.1:8000';
    process.env.RESERVATIONS_TABLE = tableName;
    process.env.WORKER_POLL_WAIT_SECONDS = '1';
    process.env.WORKER_POLL_MAX_MESSAGES = '10';

    reservationQueueUrl = await ensureQueue(uniqueQueueName('dev-reservation-events'));
    purchaseQueueUrl = await ensureQueue(uniqueQueueName('dev-purchase-events'));
    expiryQueueUrl = await ensureQueue(uniqueQueueName('dev-expiry-events'));

    process.env.RESERVATION_EVENTS_QUEUE_URL = reservationQueueUrl;
    process.env.PURCHASE_EVENTS_QUEUE_URL = purchaseQueueUrl;
    process.env.EXPIRY_EVENTS_QUEUE_URL = expiryQueueUrl;

    await resetReservationsTable(tableName);
  });

  it('polls the reservation queue, persists the durable record, and deletes the message', async () => {
    await publishEvent('reservation-created', {
      eventId: 'evt_poller_1',
      occurredAt: '2026-05-05T05:00:00.000Z',
      reservationId: 'res_poller_1',
      saleId: 'sale_sneaker_001',
      userToken: 'usr_tok_1',
      expiresAt: '2026-05-05T05:05:00.000Z'
    });

    await expect(pollQueuesOnce()).resolves.toEqual({
      reservation: 1,
      purchase: 0,
      expiry: 0
    });

    expect(await getReservationRecord(tableName, 'res_poller_1')).toMatchObject({
      reservationId: 'res_poller_1',
      saleId: 'sale_sneaker_001',
      userToken: 'usr_tok_1',
      status: 'RESERVED',
      reservationEventId: 'evt_poller_1',
      updatedAt: '2026-05-05T05:00:00.000Z'
    });
    expect(await receiveSingleMessage(reservationQueueUrl)).toBeNull();
  });

  it('handles duplicate delivery without corrupting the durable record', async () => {
    const duplicateEvent = {
      eventType: 'reservation-created' as const,
      eventId: 'evt_duplicate_delivery',
      occurredAt: '2026-05-05T05:10:00.000Z',
      reservationId: 'res_duplicate_delivery',
      saleId: 'sale_sneaker_002',
      userToken: 'usr_tok_2',
      expiresAt: '2026-05-05T05:15:00.000Z'
    };

    const sqs = createSqsClient();

    await sqs.send(
      new SendMessageCommand({
        QueueUrl: reservationQueueUrl,
        MessageBody: JSON.stringify(duplicateEvent)
      })
    );
    await sqs.send(
      new SendMessageCommand({
        QueueUrl: reservationQueueUrl,
        MessageBody: JSON.stringify(duplicateEvent)
      })
    );

    await expect(pollQueuesOnce()).resolves.toEqual({
      reservation: 2,
      purchase: 0,
      expiry: 0
    });

    expect(await getReservationRecord(tableName, 'res_duplicate_delivery')).toMatchObject({
      reservationId: 'res_duplicate_delivery',
      saleId: 'sale_sneaker_002',
      userToken: 'usr_tok_2',
      status: 'RESERVED',
      reservationEventId: 'evt_duplicate_delivery',
      updatedAt: '2026-05-05T05:10:00.000Z'
    });
    expect(await receiveSingleMessage(reservationQueueUrl)).toBeNull();
  });

  it('polls purchase and expiry queues and deletes their messages after persistence', async () => {
    const sqs = createSqsClient();

    await sqs.send(
      new SendMessageCommand({
        QueueUrl: purchaseQueueUrl,
        MessageBody: JSON.stringify({
          eventType: 'purchase-completed',
          eventId: 'evt_purchase_queue_1',
          occurredAt: '2026-05-05T05:20:00.000Z',
          reservationId: 'res_purchase_queue_1',
          saleId: 'sale_sneaker_003',
          userToken: 'usr_tok_3',
          purchasedAt: '2026-05-05T05:20:00.000Z'
        })
      })
    );
    await sqs.send(
      new SendMessageCommand({
        QueueUrl: expiryQueueUrl,
        MessageBody: JSON.stringify({
          eventType: 'reservation-expired',
          eventId: 'evt_expiry_queue_1',
          occurredAt: '2026-05-05T05:30:00.000Z',
          reservationId: 'res_expiry_queue_1',
          saleId: 'sale_sneaker_004',
          userToken: 'usr_tok_4',
          expiresAt: '2026-05-05T05:25:00.000Z'
        })
      })
    );

    await expect(pollQueuesOnce()).resolves.toEqual({
      reservation: 0,
      purchase: 1,
      expiry: 1
    });

    expect(await getReservationRecord(tableName, 'res_purchase_queue_1')).toMatchObject({
      reservationId: 'res_purchase_queue_1',
      saleId: 'sale_sneaker_003',
      userToken: 'usr_tok_3',
      status: 'PURCHASED',
      purchaseEventId: 'evt_purchase_queue_1',
      updatedAt: '2026-05-05T05:20:00.000Z'
    });
    expect(await getReservationRecord(tableName, 'res_expiry_queue_1')).toMatchObject({
      reservationId: 'res_expiry_queue_1',
      saleId: 'sale_sneaker_004',
      userToken: 'usr_tok_4',
      status: 'EXPIRED',
      expiryEventId: 'evt_expiry_queue_1',
      updatedAt: '2026-05-05T05:30:00.000Z'
    });
    expect(await receiveSingleMessage(purchaseQueueUrl)).toBeNull();
    expect(await receiveSingleMessage(expiryQueueUrl)).toBeNull();
  });

  it('continues polling purchase and expiry queues when the reservation queue has a poison message', async () => {
    const sqs = createSqsClient();

    await sqs.send(
      new SendMessageCommand({
        QueueUrl: reservationQueueUrl,
        MessageBody: JSON.stringify({
          eventType: 'unsupported-event',
          eventId: 'evt_poison_1',
          occurredAt: '2026-05-05T05:40:00.000Z',
          reservationId: 'res_poison_1'
        })
      })
    );
    await sqs.send(
      new SendMessageCommand({
        QueueUrl: purchaseQueueUrl,
        MessageBody: JSON.stringify({
          eventType: 'purchase-completed',
          eventId: 'evt_purchase_queue_2',
          occurredAt: '2026-05-05T05:41:00.000Z',
          reservationId: 'res_purchase_queue_2',
          saleId: 'sale_sneaker_005',
          userToken: 'usr_tok_5',
          purchasedAt: '2026-05-05T05:41:00.000Z'
        })
      })
    );
    await sqs.send(
      new SendMessageCommand({
        QueueUrl: expiryQueueUrl,
        MessageBody: JSON.stringify({
          eventType: 'reservation-expired',
          eventId: 'evt_expiry_queue_2',
          occurredAt: '2026-05-05T05:42:00.000Z',
          reservationId: 'res_expiry_queue_2',
          saleId: 'sale_sneaker_006',
          userToken: 'usr_tok_6',
          expiresAt: '2026-05-05T05:35:00.000Z'
        })
      })
    );

    await expect(pollQueuesOnce()).resolves.toEqual({
      reservation: 0,
      purchase: 1,
      expiry: 1
    });

    expect(await getReservationRecord(tableName, 'res_purchase_queue_2')).toMatchObject({
      reservationId: 'res_purchase_queue_2',
      status: 'PURCHASED',
      purchaseEventId: 'evt_purchase_queue_2'
    });
    expect(await getReservationRecord(tableName, 'res_expiry_queue_2')).toMatchObject({
      reservationId: 'res_expiry_queue_2',
      status: 'EXPIRED',
      expiryEventId: 'evt_expiry_queue_2'
    });
    expect(await getReservationRecord(tableName, 'res_poison_1')).toBeNull();
    expect(await receiveSingleMessage(purchaseQueueUrl)).toBeNull();
    expect(await receiveSingleMessage(expiryQueueUrl)).toBeNull();
  });
});
