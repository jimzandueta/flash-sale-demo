import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { getAppConfig } from './config';

function resolveAwsCredentials(endpoint?: string) {
  if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
    return {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    };
  }

  if (endpoint) {
    return {
      accessKeyId: 'test',
      secretAccessKey: 'test'
    };
  }

  return undefined;
}

export function createDynamoClient() {
  const config = getAppConfig();

  return DynamoDBDocumentClient.from(
    new DynamoDBClient({
      region: config.awsRegion,
      endpoint: config.dynamoEndpoint,
      credentials: resolveAwsCredentials(config.dynamoEndpoint)
    }),
    { marshallOptions: { removeUndefinedValues: true } }
  );
}
