import { UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { getAppConfig } from '../config';
import { createDynamoClient } from '../dynamoClient';
import type {
  PurchaseCompletedEvent,
  ReservationCancelledEvent,
  ReservationCreatedEvent,
  ReservationExpiredEvent
} from '../events/types';

export async function putReservationRecord(event: ReservationCreatedEvent) {
  const dynamo = createDynamoClient();
  const tableName = getAppConfig().reservationsTable;

  await dynamo.send(
    new UpdateCommand({
      TableName: tableName,
      Key: { reservationId: event.reservationId },
      UpdateExpression:
        'SET saleId = if_not_exists(saleId, :saleId), userToken = if_not_exists(userToken, :userToken), expiresAt = if_not_exists(expiresAt, :expiresAt), #status = if_not_exists(#status, :status), reservationEventId = if_not_exists(reservationEventId, :eventId), updatedAt = if_not_exists(updatedAt, :updatedAt)',
      ConditionExpression: 'attribute_not_exists(reservationId) OR reservationEventId = :eventId',
      ExpressionAttributeNames: {
        '#status': 'status'
      },
      ExpressionAttributeValues: {
        ':saleId': event.saleId,
        ':userToken': event.userToken,
        ':expiresAt': event.expiresAt,
        ':status': 'RESERVED',
        ':eventId': event.eventId,
        ':updatedAt': event.occurredAt
      }
    })
  );

  return { persisted: true };
}

export async function putPurchaseRecord(event: PurchaseCompletedEvent) {
  const dynamo = createDynamoClient();
  const tableName = getAppConfig().reservationsTable;

  try {
    await dynamo.send(
      new UpdateCommand({
        TableName: tableName,
        Key: { reservationId: event.reservationId },
        UpdateExpression:
          'SET saleId = if_not_exists(saleId, :saleId), userToken = if_not_exists(userToken, :userToken), #status = :status, purchasedAt = :purchasedAt, purchaseEventId = :eventId, updatedAt = :updatedAt',
        ConditionExpression:
          'attribute_not_exists(expiryEventId) AND (attribute_not_exists(purchaseEventId) OR purchaseEventId = :eventId)',
        ExpressionAttributeNames: {
          '#status': 'status'
        },
        ExpressionAttributeValues: {
          ':saleId': event.saleId,
          ':userToken': event.userToken,
          ':status': 'PURCHASED',
          ':purchasedAt': event.purchasedAt,
          ':eventId': event.eventId,
          ':updatedAt': event.occurredAt
        }
      })
    );
  } catch (error) {
    if ((error as { name?: string }).name === 'ConditionalCheckFailedException') {
      return { persisted: false };
    }

    throw error;
  }

  return { persisted: true };
}

export async function putExpiryRecord(event: ReservationExpiredEvent) {
  const dynamo = createDynamoClient();
  const tableName = getAppConfig().reservationsTable;

  try {
    await dynamo.send(
      new UpdateCommand({
        TableName: tableName,
        Key: { reservationId: event.reservationId },
        UpdateExpression:
          'SET saleId = if_not_exists(saleId, :saleId), userToken = if_not_exists(userToken, :userToken), expiresAt = if_not_exists(expiresAt, :expiresAt), #status = :status, expiryEventId = :eventId, updatedAt = :updatedAt',
        ConditionExpression:
          'attribute_not_exists(purchaseEventId) AND (attribute_not_exists(expiryEventId) OR expiryEventId = :eventId)',
        ExpressionAttributeNames: {
          '#status': 'status'
        },
        ExpressionAttributeValues: {
          ':saleId': event.saleId,
          ':userToken': event.userToken,
          ':expiresAt': event.expiresAt,
          ':status': 'EXPIRED',
          ':eventId': event.eventId,
          ':updatedAt': event.occurredAt
        }
      })
    );
  } catch (error) {
    if ((error as { name?: string }).name === 'ConditionalCheckFailedException') {
      return { persisted: false };
    }

    throw error;
  }

  return { persisted: true };
}

export async function putCancellationRecord(event: ReservationCancelledEvent) {
  const dynamo = createDynamoClient();
  const tableName = getAppConfig().reservationsTable;

  try {
    await dynamo.send(
      new UpdateCommand({
        TableName: tableName,
        Key: { reservationId: event.reservationId },
        UpdateExpression:
          'SET saleId = if_not_exists(saleId, :saleId), userToken = if_not_exists(userToken, :userToken), #status = :status, cancellationEventId = :eventId, updatedAt = :updatedAt',
        ConditionExpression:
          'attribute_not_exists(purchaseEventId) AND (attribute_not_exists(cancellationEventId) OR cancellationEventId = :eventId)',
        ExpressionAttributeNames: {
          '#status': 'status'
        },
        ExpressionAttributeValues: {
          ':saleId': event.saleId,
          ':userToken': event.userToken,
          ':status': 'CANCELLED',
          ':eventId': event.eventId,
          ':updatedAt': event.occurredAt
        }
      })
    );
  } catch (error) {
    if ((error as { name?: string }).name === 'ConditionalCheckFailedException') {
      return { persisted: false };
    }

    throw error;
  }

  return { persisted: true };
}
