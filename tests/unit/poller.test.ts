import { afterEach, describe, expect, it, vi } from 'vitest';
import { ReceiveMessageCommand } from '@aws-sdk/client-sqs';

const send = vi.fn();
const handleWorkerMessage = vi.fn();
const logger = {
  error: vi.fn(),
  debug: vi.fn(),
  info: vi.fn()
};

vi.mock('../../services/lambdas/shared/src/config', () => ({
  getAppConfig: () => ({
    reservationEventsQueueUrl: 'reservation-url',
    purchaseEventsQueueUrl: 'purchase-url',
    expiryEventsQueueUrl: 'expiry-url',
    workerPollWaitSeconds: 1,
    workerPollMaxMessages: 10
  })
}));

vi.mock('../../services/lambdas/shared/src/sqsClient', () => ({
  createSqsClient: () => ({ send })
}));

vi.mock('../../services/lambdas/reservation-worker/src/worker', () => ({
  handleWorkerMessage
}));

vi.mock('../../services/lambdas/shared/src/logger', () => ({ logger }));

describe('pollQueuesOnce', () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('continues polling later queues when one queue receive call fails', async () => {
    send.mockImplementation(async (command: ReceiveMessageCommand) => {
      if (command instanceof ReceiveMessageCommand) {
        if (command.input.QueueUrl === 'reservation-url') {
          throw new Error('reservation queue unavailable');
        }

        return { Messages: [] };
      }

      return {};
    });

    const { pollQueuesOnce } = await import('../../services/lambdas/reservation-worker/src/poller');

    await expect(pollQueuesOnce()).resolves.toEqual({
      reservation: 0,
      purchase: 0,
      expiry: 0
    });

    expect(
      send.mock.calls
        .map(([command]) => command)
        .filter((command) => command instanceof ReceiveMessageCommand)
        .map((command) => command.input.QueueUrl)
    ).toEqual(['reservation-url', 'purchase-url', 'expiry-url']);
    expect(logger.error).toHaveBeenCalledWith(
      'reservation-worker queue poll failed',
      'reservation',
      expect.objectContaining({ message: 'reservation queue unavailable' })
    );
  });
});
