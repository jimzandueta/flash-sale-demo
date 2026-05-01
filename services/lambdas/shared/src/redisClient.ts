import Redis from 'ioredis';
import { getAppConfig } from './config';

export function createRedisClient() {
  return new Redis(getAppConfig().redisUrl);
}