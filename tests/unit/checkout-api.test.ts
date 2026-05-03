import { afterEach, describe, expect, it, vi } from 'vitest';
import { checkoutReservation } from '../../services/lambdas/checkout-api/src/handler';
import { publishEvent } from '../../services/lambdas/shared/src/events/publishEvent';

vi.mock('../../services/lambdas/shared/src/events/publishEvent', () => ({
  publishEvent: vi.fn().mockResolvedValue({ messageId: 'msg_1' })
}));

describe('checkout handler', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('publishes a payment-failed reconciliation event', async () => {
    await checkoutReservation({
      reservationId: 'res_123',
      userToken: 'usr_tok_1',
      simulateFailure: true
    });

    expect(publishEvent).toHaveBeenCalledWith('payment-failed', {
      reservationId: 'res_123',
      userToken: 'usr_tok_1',
      status: 'PAYMENT_FAILED'
    });
  });

  it('publishes a purchase-completed reconciliation event', async () => {
    const result = await checkoutReservation({
      reservationId: 'res_456',
      userToken: 'usr_tok_1',
      simulateFailure: false
    });

    expect(result.status).toBe('PURCHASED');
    expect(publishEvent).toHaveBeenCalledWith(
      'purchase-completed',
      expect.objectContaining({
        reservationId: 'res_456',
        userToken: 'usr_tok_1',
        status: 'PURCHASED',
        purchasedAt: expect.any(String)
      })
    );
  });
});