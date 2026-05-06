import {
  DeleteMessageCommand,
  ReceiveMessageCommand,
  type Message
} from '@aws-sdk/client-sqs';
import { getAppConfig } from '../../shared/src/config';
import { logger } from '../../shared/src/logger';
import { createSqsClient } from '../../shared/src/sqsClient';
import { handleWorkerMessage } from './worker';

async function pollQueue(queueUrl: string) {
  const config = getAppConfig();
  const sqs = createSqsClient();
  const response = await sqs.send(
    new ReceiveMessageCommand({
      QueueUrl: queueUrl,
      MaxNumberOfMessages: config.workerPollMaxMessages,
      WaitTimeSeconds: config.workerPollWaitSeconds
    })
  );
  const messages = response.Messages ?? [];
  let processedCount = 0;

  for (const message of messages) {
    processedCount += await processMessage(sqs, queueUrl, message);
  }

  return processedCount;
}

async function processMessage(
  sqs: ReturnType<typeof createSqsClient>,
  queueUrl: string,
  message: Message
) {
  if (!message.Body || !message.ReceiptHandle) {
    return 0;
  }

  try {
    await handleWorkerMessage(message.Body);
    await sqs.send(
      new DeleteMessageCommand({
        QueueUrl: queueUrl,
        ReceiptHandle: message.ReceiptHandle
      })
    );

    return 1;
  } catch (error) {
    logger.error('reservation-worker message processing failed', queueUrl, error);
    return 0;
  }
}

export async function pollQueuesOnce() {
  const config = getAppConfig();

  async function pollQueueSafely(queueName: string, queueUrl: string) {
    try {
      return await pollQueue(queueUrl);
    } catch (error) {
      logger.error('reservation-worker queue poll failed', queueName, error);
      return 0;
    }
  }

  return {
    reservation: await pollQueueSafely('reservation', config.reservationEventsQueueUrl),
    purchase: await pollQueueSafely('purchase', config.purchaseEventsQueueUrl),
    expiry: await pollQueueSafely('expiry', config.expiryEventsQueueUrl)
  };
}
