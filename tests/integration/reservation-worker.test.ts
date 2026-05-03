import { describe, expect, it } from 'vitest';
import { handleReservationCreated } from '../../services/lambdas/reservation-worker/src/worker';

describe('reservation worker', () => {
  it('persists a ReservationCreated event idempotently', async () => {
    const result = await handleReservationCreated({
      eventId: 'evt_1',
      reservationId: 'res_123',
      saleId: 'sale_sneaker_001',
      userToken: 'usr_tok_1',
      expiresAt: '2026-05-06T10:05:00Z'
    });

    expect(result.persisted).toBe(true);
  });
});