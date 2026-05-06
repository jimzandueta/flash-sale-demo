export type AppConfig = {
  awsRegion: string;
  redisUrl: string;
  defaultReservationTtlSeconds: number;
  reservationsTable: string;
  reservationEventsQueueUrl: string;
  purchaseEventsQueueUrl: string;
  expiryEventsQueueUrl: string;
  sqsEndpoint?: string;
  dynamoEndpoint?: string;
  workerPollWaitSeconds: number;
  workerPollMaxMessages: number;
};

export function getAppConfig(): AppConfig {
  return {
    awsRegion: process.env.AWS_REGION ?? 'us-east-1',
    redisUrl: process.env.REDIS_URL ?? 'redis://localhost:6379',
    defaultReservationTtlSeconds: Number(process.env.DEFAULT_RESERVATION_TTL_SECONDS ?? '180'),
    reservationsTable: process.env.RESERVATIONS_TABLE ?? 'flash-sale-reservations-local',
    reservationEventsQueueUrl:
      process.env.RESERVATION_EVENTS_QUEUE_URL ??
      'http://127.0.0.1:4566/000000000000/dev-reservation-events',
    purchaseEventsQueueUrl:
      process.env.PURCHASE_EVENTS_QUEUE_URL ??
      'http://127.0.0.1:4566/000000000000/dev-purchase-events',
    expiryEventsQueueUrl:
      process.env.EXPIRY_EVENTS_QUEUE_URL ??
      'http://127.0.0.1:4566/000000000000/dev-expiry-events',
    sqsEndpoint: process.env.SQS_ENDPOINT,
    dynamoEndpoint: process.env.DYNAMO_ENDPOINT,
    workerPollWaitSeconds: Number(process.env.WORKER_POLL_WAIT_SECONDS ?? '5'),
    workerPollMaxMessages: Number(process.env.WORKER_POLL_MAX_MESSAGES ?? '10')
  };
}
