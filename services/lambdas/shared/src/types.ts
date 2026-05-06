export type SaleSummary = {
  saleId: string;
  itemName: string;
  status: 'upcoming' | 'active' | 'ended';
  startsAt: string;
  endsAt: string;
  reservationTtlSeconds: number;
  remainingStock?: number;
};
