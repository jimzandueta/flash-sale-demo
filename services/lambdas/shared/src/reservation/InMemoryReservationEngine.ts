import { randomUUID } from 'node:crypto';
import { logger } from '../logger';
import type { ReservationAttempt, ReservationEngine, ReservationResult } from './ReservationEngine';

export function createInMemoryReservationEngine(seed: {
  saleId: string;
  stock: number;
}): ReservationEngine {
  let remainingStock = seed.stock;
  const reservations = new Map<string, string>();

  return {
    async reserve(input: ReservationAttempt): Promise<ReservationResult> {
      logger.debug('reservation spike input', input, { remainingStock });

      if (reservations.has(input.userToken)) {
        return { status: 'ALREADY_RESERVED' };
      }

      if (remainingStock <= 0) {
        return { status: 'SOLD_OUT' };
      }

      remainingStock -= 1;
      const reservationId = `res_${randomUUID()}`;
      reservations.set(input.userToken, reservationId);

      return {
        status: 'RESERVED',
        reservationId,
        expiresAt: new Date(new Date(input.now).getTime() + input.ttlSeconds * 1000).toISOString(),
        remainingStock
      };
    }
  };
}