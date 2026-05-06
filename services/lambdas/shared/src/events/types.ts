export type ReservationCreatedEvent = {
  eventType: 'reservation-created';
  eventId: string;
  occurredAt: string;
  reservationId: string;
  saleId: string;
  userToken: string;
  expiresAt: string;
};

export type PurchaseCompletedEvent = {
  eventType: 'purchase-completed';
  eventId: string;
  occurredAt: string;
  reservationId: string;
  saleId: string;
  userToken: string;
  purchasedAt: string;
};

export type ReservationExpiredEvent = {
  eventType: 'reservation-expired';
  eventId: string;
  occurredAt: string;
  reservationId: string;
  saleId: string;
  userToken: string;
  expiresAt: string;
};

export type DurableEvent =
  | ReservationCreatedEvent
  | PurchaseCompletedEvent
  | ReservationExpiredEvent;

export type DurableEventType = DurableEvent['eventType'];

export type DurableEventPayloadByType = {
  'reservation-created': Omit<ReservationCreatedEvent, 'eventType'>;
  'purchase-completed': Omit<PurchaseCompletedEvent, 'eventType'>;
  'reservation-expired': Omit<ReservationExpiredEvent, 'eventType'>;
};

function readString(payload: Record<string, unknown>, field: string) {
  const value = payload[field];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function requireString(payload: Record<string, unknown>, field: string, eventType: DurableEventType) {
  const value = readString(payload, field);

  if (value) {
    return value;
  }

  throw new Error(`Missing ${field} for durable event: ${eventType}`);
}

function unknownSaleId() {
  return 'unknown-sale';
}

function assertUnhandledEventType(eventType: never): never {
  throw new Error(`Unhandled durable event type: ${eventType}`);
}

export function queueUrlForEventType(
  config: {
    reservationEventsQueueUrl: string;
    purchaseEventsQueueUrl: string;
    expiryEventsQueueUrl: string;
  },
  eventType: DurableEventType
) {
  switch (eventType) {
    case 'reservation-created':
      return config.reservationEventsQueueUrl;
    case 'purchase-completed':
      return config.purchaseEventsQueueUrl;
    case 'reservation-expired':
      return config.expiryEventsQueueUrl;
    default:
      return assertUnhandledEventType(eventType);
  }
}

export function buildDurableEvent<T extends DurableEventType>(
  eventType: T,
  payload: DurableEventPayloadByType[T] | Record<string, unknown>
) {
  const runtimePayload = payload as Record<string, unknown>;

  switch (eventType) {
    case 'reservation-created': {
      const event = {
        eventType,
        eventId:
          readString(runtimePayload, 'eventId') ??
          `reservation-created:${requireString(runtimePayload, 'reservationId', eventType)}`,
        occurredAt: readString(runtimePayload, 'occurredAt') ?? new Date().toISOString(),
        reservationId: requireString(runtimePayload, 'reservationId', eventType),
        saleId: readString(runtimePayload, 'saleId') ?? unknownSaleId(),
        userToken: requireString(runtimePayload, 'userToken', eventType),
        expiresAt: requireString(runtimePayload, 'expiresAt', eventType)
      } satisfies ReservationCreatedEvent;

      return event as Extract<DurableEvent, { eventType: T }>;
    }
    case 'purchase-completed': {
      const reservationId = requireString(runtimePayload, 'reservationId', eventType);
      const purchasedAt = requireString(runtimePayload, 'purchasedAt', eventType);
      const event = {
        eventType,
        eventId:
          readString(runtimePayload, 'eventId') ?? `purchase-completed:${reservationId}:${purchasedAt}`,
        occurredAt: readString(runtimePayload, 'occurredAt') ?? purchasedAt,
        reservationId,
        saleId: readString(runtimePayload, 'saleId') ?? unknownSaleId(),
        userToken: requireString(runtimePayload, 'userToken', eventType),
        purchasedAt
      } satisfies PurchaseCompletedEvent;

      return event as Extract<DurableEvent, { eventType: T }>;
    }
    case 'reservation-expired': {
      const event = {
        eventType,
        eventId:
          readString(runtimePayload, 'eventId') ??
          `reservation-expired:${requireString(runtimePayload, 'reservationId', eventType)}`,
        occurredAt:
          readString(runtimePayload, 'occurredAt') ??
          requireString(runtimePayload, 'expiresAt', eventType),
        reservationId: requireString(runtimePayload, 'reservationId', eventType),
        saleId: readString(runtimePayload, 'saleId') ?? unknownSaleId(),
        userToken: requireString(runtimePayload, 'userToken', eventType),
        expiresAt: requireString(runtimePayload, 'expiresAt', eventType)
      } satisfies ReservationExpiredEvent;

      return event as Extract<DurableEvent, { eventType: T }>;
    }
    default:
      return assertUnhandledEventType(eventType);
  }
}
