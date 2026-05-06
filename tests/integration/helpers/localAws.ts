import {
  CreateQueueCommand,
  GetQueueUrlCommand,
  ReceiveMessageCommand,
  SQSClient
} from '@aws-sdk/client-sqs';
import {
  CreateTableCommand,
  DeleteTableCommand,
  DynamoDBClient,
  waitUntilTableExists,
  waitUntilTableNotExists
} from '@aws-sdk/client-dynamodb';
import { GetCommand, DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { randomUUID } from 'node:crypto';

const region = process.env.AWS_REGION ?? 'us-east-1';
const endpoint = process.env.SQS_ENDPOINT ?? 'http://127.0.0.1:4566';
const dynamoEndpoint = process.env.DYNAMO_ENDPOINT ?? 'http://127.0.0.1:8000';
const credentials = {
  accessKeyId: process.env.AWS_ACCESS_KEY_ID ?? 'test',
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? 'test'
};

export function createLocalSqsClient() {
  return new SQSClient({ region, endpoint, credentials });
}

export function createLocalDynamoClient() {
  return new DynamoDBClient({ region, endpoint: dynamoEndpoint, credentials });
}

export function createLocalDynamoDocumentClient() {
  return DynamoDBDocumentClient.from(createLocalDynamoClient(), {
    marshallOptions: { removeUndefinedValues: true }
  });
}

export async function ensureQueue(queueName: string) {
  const sqs = createLocalSqsClient();
  await sqs.send(new CreateQueueCommand({ QueueName: queueName }));
  const queueUrl = await sqs.send(new GetQueueUrlCommand({ QueueName: queueName }));
  return queueUrl.QueueUrl as string;
}

export function uniqueQueueName(prefix: string) {
  return `${prefix}-${randomUUID()}`;
}

export async function receiveSingleMessage(queueUrl: string) {
  const sqs = createLocalSqsClient();
  const response = await sqs.send(
    new ReceiveMessageCommand({ QueueUrl: queueUrl, MaxNumberOfMessages: 1, WaitTimeSeconds: 1 })
  );
  return response.Messages?.[0] ?? null;
}

export async function resetReservationsTable(tableName: string) {
  const dynamo = createLocalDynamoClient();

  try {
    await dynamo.send(new DeleteTableCommand({ TableName: tableName }));
    await waitUntilTableNotExists({ client: dynamo, maxWaitTime: 21 }, { TableName: tableName });
  } catch (error) {
    if ((error as { name?: string }).name !== 'ResourceNotFoundException') {
      throw error;
    }
  }

  await dynamo.send(
    new CreateTableCommand({
      TableName: tableName,
      BillingMode: 'PAY_PER_REQUEST',
      KeySchema: [{ AttributeName: 'reservationId', KeyType: 'HASH' }],
      AttributeDefinitions: [{ AttributeName: 'reservationId', AttributeType: 'S' }]
    })
  );

  await waitUntilTableExists({ client: dynamo, maxWaitTime: 21 }, { TableName: tableName });
}

export async function getReservationRecord(tableName: string, reservationId: string) {
  const dynamo = createLocalDynamoDocumentClient();
  const response = await dynamo.send(
    new GetCommand({ TableName: tableName, Key: { reservationId } })
  );

  return response.Item ?? null;
}
