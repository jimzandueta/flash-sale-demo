import type { ReservationEngine } from '../../shared/src/reservation/ReservationEngine';

export async function reserveSale(
  engine: ReservationEngine,
  input: { saleId: string; userToken: string; ttlSeconds: number; now: string }
) {
  return engine.reserve(input);
}