import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import type Redis from 'ioredis';
import { redisKeys } from '../redisKeys';
import type { ReservationAttempt, ReservationEngine, ReservationResult } from './ReservationEngine';

const reserveStockScript = readFileSync(new URL('./reserveStock.lua', import.meta.url), 'utf8');

export class RedisReservationEngine implements ReservationEngine {
  constructor(private readonly redis: Redis) {}

  async reserve(input: ReservationAttempt): Promise<ReservationResult> {
    const reservationId = `res_${randomUUID()}`;
    const expiresAt = String(Date.parse(input.now) + input.ttlSeconds * 1000);
    const idempotencyEnabled = typeof input.idempotencyKey === 'string' && input.idempotencyKey.length > 0;
    const idempotencyKey = input.idempotencyKey ?? '__disabled__';
    const result = (await this.redis.eval(
      reserveStockScript,
      6,
      redisKeys.stock(input.saleId),
      redisKeys.saleUser(input.saleId, input.userToken),
      redisKeys.userReservations(input.userToken),
      redisKeys.reservation(reservationId),
      redisKeys.expiries(input.saleId),
      redisKeys.reservationIdempotency(input.saleId, input.userToken, idempotencyKey),
      reservationId,
      expiresAt,
      input.ttlSeconds,
      input.saleId,
      input.userToken,
      idempotencyEnabled ? '1' : '0'
    )) as string[];

    if (result[0] === 'ALREADY_RESERVED') {
      return { status: 'ALREADY_RESERVED' };
    }

    if (result[0] === 'SOLD_OUT') {
      return { status: 'SOLD_OUT' };
    }

    return {
      status: 'RESERVED',
      reservationId: result[1],
      remainingStock: Number(result[2]),
      expiresAt: new Date(Number(result[3])).toISOString(),
      shouldPublishEvent: result[4] !== 'REPLAYED'
    };
  }
}