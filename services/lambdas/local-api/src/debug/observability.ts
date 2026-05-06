import { GetQueueAttributesCommand } from '@aws-sdk/client-sqs';
import { ScanCommand } from '@aws-sdk/lib-dynamodb';
import type Redis from 'ioredis';
import { getAppConfig } from '../../../shared/src/config';
import { createDynamoClient } from '../../../shared/src/dynamoClient';
import { redisKeys } from '../../../shared/src/redisKeys';
import { createSqsClient } from '../../../shared/src/sqsClient';
import type { ObservabilitySnapshot, SubsystemStatus } from './types';

type Inputs = {
  workerMode: ObservabilitySnapshot['workerMode'];
  app: {
    page: string;
    cartCount: number;
    purchaseCount: number;
    activeSaleCount: number;
    userLabel: string;
  };
  shopper: {
    userToken?: string;
    displayName?: string;
  };
  readRedis: () => Promise<ObservabilitySnapshot['redis']>;
  readSqs: () => Promise<ObservabilitySnapshot['sqs']>;
  readDynamo: () => Promise<ObservabilitySnapshot['dynamodb']>;
  manualWorker: ObservabilitySnapshot['manualWorker'];
};

function stageStatus(status: SubsystemStatus) {
  if (status === 'unavailable') return 'unavailable' as const;
  if (status === 'warning') return 'warning' as const;
  return 'complete' as const;
}

function sortDurableRecordsNewestFirst(
  records: ObservabilitySnapshot['dynamodb']['shopperRecords']
) {
  return [...records].sort((left, right) => {
    const leftUpdatedAt = left.updatedAt ? Date.parse(left.updatedAt) : Number.NEGATIVE_INFINITY;
    const rightUpdatedAt = right.updatedAt ? Date.parse(right.updatedAt) : Number.NEGATIVE_INFINITY;

    return rightUpdatedAt - leftUpdatedAt;
  });
}

export async function buildObservabilitySnapshot(input: Inputs): Promise<ObservabilitySnapshot> {
  const [redis, sqs, dynamodbRead] = await Promise.all([
    input.readRedis(),
    input.readSqs().catch(() => ({
      status: 'unavailable' as const,
      queues: []
    })),
    input.readDynamo().catch(() => ({
      status: 'unavailable' as const,
      tableName: getAppConfig().reservationsTable,
      shopperRecords: []
    }))
  ]);
  const dynamodb = {
    ...dynamodbRead,
    shopperRecords: sortDurableRecordsNewestFirst(dynamodbRead.shopperRecords)
  };

  const pendingSqsCount =
    sqs.status === 'unavailable'
      ? null
      : sqs.queues.reduce((sum, queue) => sum + (queue.visibleMessages ?? 0), 0);

  return {
    generatedAt: new Date().toISOString(),
    workerMode: input.workerMode,
    shopper: input.shopper,
    app: {
      ...input.app,
      pendingSqsCount
    },
    pipeline: [
      {
        stage: 'shopper',
        status: input.shopper.userToken ? 'active' : 'idle',
        title: 'Shopper',
        summary: input.shopper.userToken ? `${input.app.userLabel} is active` : 'Waiting for session'
      },
      {
        stage: 'redis',
        status: stageStatus(redis.status),
        title: 'Redis',
        summary:
          redis.status === 'unavailable'
            ? 'Redis data unavailable'
            : `${redis.reservations.length} live reservation(s)`
      },
      {
        stage: 'sqs',
        status:
          sqs.status === 'unavailable'
            ? 'unavailable'
            : (pendingSqsCount ?? 0) > 0
              ? 'waiting'
              : stageStatus(sqs.status),
        title: 'SQS',
        summary:
          sqs.status === 'unavailable'
            ? 'Queue data unavailable'
            : `${pendingSqsCount ?? 0} queued message(s)`
      },
      {
        stage: 'worker',
        status:
          input.manualWorker.lastError
            ? 'warning'
            : sqs.status === 'unavailable'
              ? 'warning'
              : 'idle',
        title: 'Worker',
        summary: input.manualWorker.lastError
          ? input.manualWorker.lastError
          : input.manualWorker.lastRunAt
            ? `Last run at ${input.manualWorker.lastRunAt}`
            : input.workerMode === 'heartbeat'
              ? 'Heartbeat polling is active'
              : 'Waiting for manual trigger'
      },
      {
        stage: 'dynamodb',
        status: stageStatus(dynamodb.status),
        title: 'DynamoDB',
        summary:
          dynamodb.status === 'unavailable'
            ? 'DynamoDB data unavailable'
            : `${dynamodb.shopperRecords.length} durable record(s)`
      }
    ],
    redis,
    sqs,
    dynamodb,
    manualWorker: input.manualWorker
  };
}

export async function readRedisObservability(
  redis: Pick<Redis, 'get' | 'smembers' | 'hgetall' | 'zcard'>,
  input: { userToken?: string; saleIds: string[] }
): Promise<ObservabilitySnapshot['redis']> {
  const userReservationIds = input.userToken
    ? await redis.smembers(redisKeys.userReservations(input.userToken))
    : [];
  const reservationPayloads = await Promise.all(
    userReservationIds.map(async (reservationId) => {
      const payload = await redis.hgetall(redisKeys.reservation(reservationId));

      if (!payload.saleId || !payload.userToken || !payload.status || !payload.expiresAt) {
        return null;
      }

      const expiresAt = Number(payload.expiresAt);

      if (!Number.isFinite(expiresAt)) {
        return null;
      }

      const expiresAtDate = new Date(expiresAt);

      if (Number.isNaN(expiresAtDate.getTime())) {
        return null;
      }

      return {
        reservationId,
        saleId: payload.saleId,
        userToken: payload.userToken,
        status: payload.status,
        expiresAt: expiresAtDate.toISOString()
      };
    })
  );
  const reservations = reservationPayloads.filter(
    (reservation): reservation is ObservabilitySnapshot['redis']['reservations'][number] => reservation !== null
  );

  const stockBySale = await Promise.all(
    input.saleIds.map(async (saleId) => {
      const raw = await redis.get(redisKeys.stock(saleId));
      return { saleId, stock: raw === null ? null : Number(raw) };
    })
  );

  const expiryQueues = await Promise.all(
    input.saleIds.map(async (saleId) => ({
      saleId,
      size: await redis.zcard(redisKeys.expiries(saleId))
    }))
  );

  return {
    status: 'ok',
    stockBySale,
    userReservationIds,
    reservations,
    expiryQueues
  };
}

export async function readSqsObservability(): Promise<ObservabilitySnapshot['sqs']> {
  const config = getAppConfig();
  const sqs = createSqsClient();
  const queues = await Promise.all(
    [
      { type: 'reservation' as const, queueUrl: config.reservationEventsQueueUrl },
      { type: 'purchase' as const, queueUrl: config.purchaseEventsQueueUrl },
      { type: 'expiry' as const, queueUrl: config.expiryEventsQueueUrl }
    ].map(async ({ type, queueUrl }) => {
      const response = await sqs.send(
        new GetQueueAttributesCommand({
          QueueUrl: queueUrl,
          AttributeNames: ['ApproximateNumberOfMessages', 'ApproximateNumberOfMessagesNotVisible']
        })
      );

      return {
        type,
        queueUrl,
        visibleMessages: response.Attributes?.ApproximateNumberOfMessages
          ? Number(response.Attributes.ApproximateNumberOfMessages)
          : null,
        inFlightMessages: response.Attributes?.ApproximateNumberOfMessagesNotVisible
          ? Number(response.Attributes.ApproximateNumberOfMessagesNotVisible)
          : null
      };
    })
  );

  return { status: 'ok', queues };
}

export async function readDynamoObservability(input: {
  userToken?: string;
}): Promise<ObservabilitySnapshot['dynamodb']> {
  const config = getAppConfig();
  const dynamo = createDynamoClient();
  const response = await dynamo.send(
    new ScanCommand({ TableName: config.reservationsTable })
  );
  const items = response.Items ?? [];

  return {
    status: 'ok',
    tableName: config.reservationsTable,
    shopperRecords: sortDurableRecordsNewestFirst(
      items.map((item) => ({
        reservationId: String(item.reservationId),
        saleId: String(item.saleId),
        userToken: String(item.userToken),
        status: String(item.status),
        expiresAt: item.expiresAt ? String(item.expiresAt) : undefined,
        purchasedAt: item.purchasedAt ? String(item.purchasedAt) : undefined,
        updatedAt: item.updatedAt ? String(item.updatedAt) : undefined,
        reservationEventId: item.reservationEventId ? String(item.reservationEventId) : undefined,
        purchaseEventId: item.purchaseEventId ? String(item.purchaseEventId) : undefined,
        expiryEventId: item.expiryEventId ? String(item.expiryEventId) : undefined
      }))
    )
  };
}
