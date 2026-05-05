import { createSqsClient } from '../sqsClient';
import { logger } from '../logger';

export async function publishEvent(queueName: string, payload: Record<string, unknown>) {
  const sqs = createSqsClient();

  logger.debug('publishEvent', queueName, payload, sqs);

  return {
    messageId: `msg_${String(payload.eventId ?? 'unknown')}`
  };
}