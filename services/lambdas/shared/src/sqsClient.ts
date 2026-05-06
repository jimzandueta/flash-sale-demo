import { SQSClient } from '@aws-sdk/client-sqs';
import { getAppConfig } from './config';

function inferLocalSqsEndpoint(queueUrl: string) {
  const url = new URL(queueUrl);

  if (url.hostname === '127.0.0.1' || url.hostname === 'localhost') {
    return `${url.protocol}//${url.host}`;
  }

  return undefined;
}

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

export function createSqsClient() {
  const config = getAppConfig();
  const endpoint = config.sqsEndpoint ?? inferLocalSqsEndpoint(config.reservationEventsQueueUrl);

  return new SQSClient({
    region: config.awsRegion,
    endpoint,
    credentials: resolveAwsCredentials(endpoint)
  });
}
