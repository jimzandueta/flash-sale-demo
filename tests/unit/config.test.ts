import { beforeEach, describe, expect, it } from 'vitest';
import { getAppConfig } from '../../services/lambdas/shared/src/config';

describe('getAppConfig', () => {
  beforeEach(() => {
    process.env.DEFAULT_RESERVATION_TTL_SECONDS = '300';
    process.env.REDIS_URL = 'redis://localhost:6379';
    process.env.AWS_REGION = 'us-east-1';
  });

  it('reads the default reservation ttl from env', () => {
    expect(getAppConfig().defaultReservationTtlSeconds).toBe(300);
  });
});