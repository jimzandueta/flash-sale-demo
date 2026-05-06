import { logger } from '../../shared/src/logger';
import type {
  DurableEvent,
  DurableEventPayloadByType
} from '../../shared/src/events/types';
import {
  putExpiryRecord,
  putPurchaseRecord,
  putReservationRecord
} from '../../shared/src/repositories/ReservationsRepository';

function assertUnhandledEventType(eventType: never): never {
  throw new Error(`Unhandled durable event type: ${eventType}`);
}

export async function handleReservationCreated(
  event: DurableEventPayloadByType['reservation-created']
) {
  logger.debug('reservation-worker persisting', event);

  return putReservationRecord({ eventType: 'reservation-created', ...event });
}

export async function handlePurchaseCompleted(
  event: DurableEventPayloadByType['purchase-completed']
) {
  logger.debug('reservation-worker persisting', event);

  return putPurchaseRecord({ eventType: 'purchase-completed', ...event });
}

export async function handleReservationExpired(
  event: DurableEventPayloadByType['reservation-expired']
) {
  logger.debug('reservation-worker persisting', event);

  return putExpiryRecord({ eventType: 'reservation-expired', ...event });
}

export async function handleDurableEvent(event: DurableEvent) {
  const eventType = event.eventType;

  switch (event.eventType) {
    case 'reservation-created':
      return handleReservationCreated(event);
    case 'purchase-completed':
      return handlePurchaseCompleted(event);
    case 'reservation-expired':
      return handleReservationExpired(event);
    default:
      return assertUnhandledEventType(eventType as never);
  }
}

export async function handleWorkerMessage(messageBody: string) {
  return handleDurableEvent(JSON.parse(messageBody) as DurableEvent);
}
