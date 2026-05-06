import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DeleteTableCommand, ListTablesCommand, waitUntilTableNotExists } from '@aws-sdk/client-dynamodb';
import { createLocalDynamoClient } from './helpers/localAws';

describe('local api bootstrap', () => {
  const tableName = 'flash-sale-reservations-local';

  afterEach(() => {
    vi.doUnmock('../../tests/integration/helpers/localAws');
    vi.resetModules();
    vi.restoreAllMocks();
  });

  beforeEach(async () => {
    process.env.AWS_REGION = 'us-east-1';
    process.env.AWS_ACCESS_KEY_ID = 'test';
    process.env.AWS_SECRET_ACCESS_KEY = 'test';
    process.env.REDIS_URL = 'redis://127.0.0.1:6379';
    process.env.DYNAMO_ENDPOINT = 'http://127.0.0.1:8000';
    process.env.RESERVATIONS_TABLE = tableName;

    const dynamo = createLocalDynamoClient();

    try {
      await dynamo.send(new DeleteTableCommand({ TableName: tableName }));
      await waitUntilTableNotExists({ client: dynamo, maxWaitTime: 21 }, { TableName: tableName });
    } catch (error) {
      if ((error as { name?: string }).name !== 'ResourceNotFoundException') {
        throw error;
      }
    }
  });

  it('creates the durable reservations table on startup when missing', async () => {
    const { buildServer } = await import('../../services/lambdas/local-api/src/server');
    const app = await buildServer();
    const dynamo = createLocalDynamoClient();

    const tables = await dynamo.send(new ListTablesCommand({}));

    expect(tables.TableNames ?? []).toContain(tableName);

    await app.close();
  });

  it('retries local Dynamo bootstrap when initial connection attempts are refused', async () => {
    const actual = await import('./helpers/localAws');
    const refusal = Object.assign(new Error('connect ECONNREFUSED 127.0.0.1:8000'), {
      code: 'ECONNREFUSED'
    });
    const realDynamo = actual.createLocalDynamoClient();
    const send = vi
      .fn()
      .mockRejectedValueOnce(refusal)
      .mockRejectedValueOnce(refusal)
      .mockImplementation((command: Parameters<typeof realDynamo.send>[0]) => realDynamo.send(command));

    vi.doMock('../../tests/integration/helpers/localAws', () => ({
      ...actual,
      createLocalDynamoClient: () => ({ send })
    }));

    const { buildServer } = await import('../../services/lambdas/local-api/src/server');

    const app = await buildServer();
    const tables = await realDynamo.send(new ListTablesCommand({}));

    expect(tables.TableNames ?? []).toContain(tableName);
    expect(send).toHaveBeenCalled();

    await app.close();
  });
});
