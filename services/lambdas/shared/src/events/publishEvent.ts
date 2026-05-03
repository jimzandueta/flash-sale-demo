import { createSqsClient } from '../sqsClient';

export async function publishEvent(queueName: string, payload: Record<string, unknown>) {
  const sqs = createSqsClient();

  console.log('[publishEvent]', queueName, payload, sqs);

  return {
    messageId: `msg_${String(payload.eventId ?? 'unknown')}`
  };
}