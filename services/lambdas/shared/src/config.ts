export type AppConfig = {
  awsRegion: string;
  redisUrl: string;
  defaultReservationTtlSeconds: number;
};

export function getAppConfig(): AppConfig {
  return {
    awsRegion: process.env.AWS_REGION ?? 'us-east-1',
    redisUrl: process.env.REDIS_URL ?? 'redis://localhost:6379',
    defaultReservationTtlSeconds: Number(process.env.DEFAULT_RESERVATION_TTL_SECONDS ?? '300')
  };
}