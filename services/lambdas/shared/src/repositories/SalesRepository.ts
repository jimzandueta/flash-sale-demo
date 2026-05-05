import { getAppConfig } from '../config';
import type { SaleSummary } from '../types';

function relativeIso(offsetMs: number): string {
  return new Date(Date.now() + offsetMs).toISOString();
}

function deriveStatus(startsAt: string, endsAt: string): SaleSummary['status'] {
  const now = Date.now();
  if (now < Date.parse(startsAt)) return 'upcoming';
  if (now > Date.parse(endsAt)) return 'ended';
  return 'active';
}

export function listSeedSales(): SaleSummary[] {
  const ttl = getAppConfig().defaultReservationTtlSeconds;

  const seeds = [
    {
      saleId: 'sale_sneaker_001',
      itemName: 'Limited Sneaker',
      startsAt: relativeIso(-10 * 60 * 1000),
      endsAt: relativeIso(50 * 60 * 1000),
      reservationTtlSeconds: ttl
    },
    {
      saleId: 'sale_jacket_002',
      itemName: 'Track Jacket',
      startsAt: relativeIso(-5 * 60 * 1000),
      endsAt: relativeIso(25 * 60 * 1000),
      reservationTtlSeconds: ttl
    },
    {
      saleId: 'sale_cap_003',
      itemName: 'Collector Cap',
      startsAt: relativeIso(60 * 60 * 1000),
      endsAt: relativeIso(90 * 60 * 1000),
      reservationTtlSeconds: ttl
    },
    {
      saleId: 'sale_watch_004',
      itemName: 'Retro Watch',
      startsAt: relativeIso(-120 * 60 * 1000),
      endsAt: relativeIso(-60 * 60 * 1000),
      reservationTtlSeconds: ttl
    }
  ];

  return seeds.map((s) => ({
    ...s,
    status: deriveStatus(s.startsAt, s.endsAt)
  }));
}
