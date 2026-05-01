import { getAppConfig } from '../config';
import type { SaleSummary } from '../types';

export function listSeedSales(): SaleSummary[] {
  const ttl = getAppConfig().defaultReservationTtlSeconds;

  return [
    {
      saleId: 'sale_sneaker_001',
      itemName: 'Limited Sneaker',
      status: 'active',
      startsAt: '2026-05-06T10:00:00Z',
      endsAt: '2026-05-06T12:00:00Z',
      reservationTtlSeconds: ttl
    },
    {
      saleId: 'sale_jacket_002',
      itemName: 'Track Jacket',
      status: 'active',
      startsAt: '2026-05-06T10:15:00Z',
      endsAt: '2026-05-06T12:30:00Z',
      reservationTtlSeconds: ttl
    },
    {
      saleId: 'sale_cap_003',
      itemName: 'Collector Cap',
      status: 'upcoming',
      startsAt: '2026-05-06T13:00:00Z',
      endsAt: '2026-05-06T14:00:00Z',
      reservationTtlSeconds: ttl
    },
    {
      saleId: 'sale_watch_004',
      itemName: 'Retro Watch',
      status: 'ended',
      startsAt: '2026-05-06T07:30:00Z',
      endsAt: '2026-05-06T08:30:00Z',
      reservationTtlSeconds: ttl
    }
  ];
}