import { GetQueueAttributesCommand } from '@aws-sdk/client-sqs';
import { ScanCommand } from '@aws-sdk/lib-dynamodb';
import Redis from 'ioredis';
import { getAppConfig } from '../../services/lambdas/shared/src/config';
import { createLocalDynamoDocumentClient, createLocalSqsClient } from '../integration/helpers/localAws';
import {
  verifyDurableReservationInvariant,
  verifyQueueDrainInvariant,
  verifyStockInvariant
} from './verify-invariants';

const initialStockBySale = new Map([
  ['sale_sneaker_001', 10],
  ['sale_jacket_002', 5]
]);

async function getQueueDepth(queueUrl: string) {
  const sqs = createLocalSqsClient();
  const response = await sqs.send(
    new GetQueueAttributesCommand({
      QueueUrl: queueUrl,
      AttributeNames: ['ApproximateNumberOfMessages']
    })
  );

  return Number(response.Attributes?.ApproximateNumberOfMessages ?? '0');
}

async function waitForQueuesDrain(config: ReturnType<typeof getAppConfig>, timeoutMs = 30000) {
  const checkIntervalMs = 1000;
  const maxAttempts = timeoutMs / checkIntervalMs;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const reservationQueueDepth = await getQueueDepth(config.reservationEventsQueueUrl);
    const purchaseQueueDepth = await getQueueDepth(config.purchaseEventsQueueUrl);
    const expiryQueueDepth = await getQueueDepth(config.expiryEventsQueueUrl);
    const total = reservationQueueDepth + purchaseQueueDepth + expiryQueueDepth;

    if (total === 0) {
      console.log(`Queues drained after ${((attempt + 1) * checkIntervalMs) / 1000}s`);
      return { reservationQueueDepth: 0, purchaseQueueDepth: 0, expiryQueueDepth: 0 };
    }

    console.log(`Waiting for queues to drain... ${total} messages remaining`);
    await new Promise((resolve) => setTimeout(resolve, checkIntervalMs));
  }

  const reservationQueueDepth = await getQueueDepth(config.reservationEventsQueueUrl);
  const purchaseQueueDepth = await getQueueDepth(config.purchaseEventsQueueUrl);
  const expiryQueueDepth = await getQueueDepth(config.expiryEventsQueueUrl);

  return { reservationQueueDepth, purchaseQueueDepth, expiryQueueDepth };
}

async function main() {
  const config = getAppConfig();
  const redis = new Redis(config.redisUrl);
  const dynamo = createLocalDynamoDocumentClient();
  const saleId = process.env.STRESS_SALE_ID ?? 'sale_sneaker_001';
  const initialStock = Number(process.env.STRESS_INITIAL_STOCK ?? initialStockBySale.get(saleId) ?? '10');

  console.log('Waiting for queues to drain before verifying...');
  const { reservationQueueDepth, purchaseQueueDepth, expiryQueueDepth } = await waitForQueuesDrain(config);

  try {
    const remainingStock = Number(await redis.get(`sale:${saleId}:stock`) ?? String(initialStock));
    const reservationIds = await redis.zrange(`sale:${saleId}:expiries`, 0, -1);
    const activeReserved = reservationIds.length;

    const scan = await dynamo.send(
      new ScanCommand({
        TableName: config.reservationsTable,
        FilterExpression: 'saleId = :saleId',
        ExpressionAttributeValues: {
          ':saleId': saleId
        }
      })
    );

    const persistedReservations = (scan.Items ?? []).length;
    const purchased = (scan.Items ?? []).filter((item) => item.status === 'PURCHASED').length;

    verifyStockInvariant({
      purchased,
      activeReserved,
      remainingStock,
      initialStock
    });
    verifyDurableReservationInvariant({
      persistedReservations,
      initialStock
    });
    verifyQueueDrainInvariant({
      reservationQueueDepth,
      purchaseQueueDepth,
      expiryQueueDepth
    });

    console.log(
      JSON.stringify(
        {
          saleId,
          initialStock,
          remainingStock,
          activeReserved,
          purchased,
          persistedReservations,
          queues: {
            reservation: reservationQueueDepth,
            purchase: purchaseQueueDepth,
            expiry: expiryQueueDepth
          }
        },
        null,
        2
      )
    );
  } finally {
    await redis.quit();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
