import type Redis from 'ioredis';
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

  it('publishes PurchaseCompleted only when Redis returns PURCHASED', async () => {
    const redis = {
      eval: vi.fn().mockResolvedValue([
        'PURCHASED',
        '2026-05-06T10:02:10.000Z',
        'sale_sneaker_001'
      ])
    };

    const result = await checkoutReservation(redis as Pick<Redis, 'eval'>, {
      reservationId: 'res_456',
      userToken: 'usr_tok_1',
      simulateFailure: false,
      now: '2026-05-06T10:02:10.000Z',
      idempotencyKey: 'idem_checkout_1'
    });

    expect(result).toEqual({
      status: 'PURCHASED',
      reservationId: 'res_456',
      purchasedAt: '2026-05-06T10:02:10.000Z'
    });
    expect(publishEvent).toHaveBeenCalledWith(
      'purchase-completed',
      {
        eventId: 'idem_checkout_1',
        occurredAt: '2026-05-06T10:02:10.000Z',
        reservationId: 'res_456',
        saleId: 'sale_sneaker_001',
        userToken: 'usr_tok_1',
        purchasedAt: '2026-05-06T10:02:10.000Z'
      }
    );
  });

  it('falls back to reservationId for purchase eventId when idempotencyKey is absent', async () => {
    const redis = {
      eval: vi.fn().mockResolvedValue(['PURCHASED', '2026-05-06T10:02:10.000Z', 'sale_sneaker_001'])
    };

    await checkoutReservation(redis as Pick<Redis, 'eval'>, {
      reservationId: 'res_456',
      userToken: 'usr_tok_1',
      simulateFailure: false,
      now: '2026-05-06T10:02:10.000Z'
    });

    expect(publishEvent).toHaveBeenCalledWith(
      'purchase-completed',
      expect.objectContaining({
        eventId: 'res_456',
        occurredAt: '2026-05-06T10:02:10.000Z',
        reservationId: 'res_456',
        saleId: 'sale_sneaker_001',
        userToken: 'usr_tok_1',
        purchasedAt: '2026-05-06T10:02:10.000Z'
      })
    );
  });

  it('returns PAYMENT_FAILED without publishing when Redis keeps the hold active', async () => {
    const redis = {
      eval: vi.fn().mockResolvedValue(['PAYMENT_FAILED'])
    };

    const result = await checkoutReservation(redis as Pick<Redis, 'eval'>, {
      reservationId: 'res_123',
      userToken: 'usr_tok_1',
      simulateFailure: true,
      now: '2026-05-06T10:01:00.000Z'
    });

    expect(result).toEqual({
      status: 'PAYMENT_FAILED',
      reservationId: 'res_123'
    });
    expect(publishEvent).not.toHaveBeenCalled();
  });

  it('returns RESERVATION_EXPIRED without publishing when Redis releases the hold', async () => {
    const redis = {
      eval: vi.fn().mockResolvedValue(['RESERVATION_EXPIRED'])
    };

    const result = await checkoutReservation(redis as Pick<Redis, 'eval'>, {
      reservationId: 'res_789',
      userToken: 'usr_tok_1',
      simulateFailure: false,
      now: '2026-05-06T10:06:00.000Z'
    });

    expect(result).toEqual({
      status: 'RESERVATION_EXPIRED',
      reservationId: 'res_789'
    });
    expect(publishEvent).not.toHaveBeenCalled();
  });
});
