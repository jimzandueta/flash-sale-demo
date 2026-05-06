import { SendMessageCommand } from '@aws-sdk/client-sqs';
import { getAppConfig } from '../config';
import { logger } from '../logger';
import { createSqsClient } from '../sqsClient';
import {
  buildDurableEvent,
  queueUrlForEventType,
  type DurableEventPayloadByType,
  type DurableEventType
} from './types';

export async function publishEvent<T extends DurableEventType>(
  eventType: T,
  payload: DurableEventPayloadByType[T]
): Promise<{ messageId: string }>;
export async function publishEvent(
  eventType: DurableEventType,
  payload: Record<string, unknown>
): Promise<{ messageId: string }>;
export async function publishEvent(
  eventType: DurableEventType,
  payload: Record<string, unknown>
): Promise<{ messageId: string }> {
  const config = getAppConfig();
  const sqs = createSqsClient();
  const event = buildDurableEvent(
    eventType,
    payload as DurableEventPayloadByType[typeof eventType]
  );
  const queueUrl = queueUrlForEventType(config, eventType);

  const response = await sqs.send(
    new SendMessageCommand({
      QueueUrl: queueUrl,
      MessageBody: JSON.stringify(event)
    })
  );

  logger.debug('publishEvent', eventType, response.MessageId);

  return { messageId: response.MessageId ?? 'unknown' };
}
