export type ReservationAttempt = {
  saleId: string;
  userToken: string;
  ttlSeconds: number;
  now: string;
};

export type ReservationResult =
  | {
      status: 'RESERVED';
      reservationId: string;
      expiresAt: string;
      remainingStock: number;
    }
  | { status: 'ALREADY_RESERVED' }
  | { status: 'SOLD_OUT' };

export interface ReservationEngine {
  reserve(input: ReservationAttempt): Promise<ReservationResult>;
}