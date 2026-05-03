import { describe, expect, it } from 'vitest';
import { buildServer } from '../../services/lambdas/local-api/src/server';

describe('checkout endpoint', () => {
  it('returns PAYMENT_FAILED when the simulateFailure flag is true', async () => {
    const app = await buildServer();

    const response = await app.inject({
      method: 'POST',
      url: '/reservations/res_123/checkout',
      headers: { 'x-user-token': 'usr_tok_1', 'idempotency-key': 'checkout_1' },
      payload: { simulateFailure: true }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().status).toBe('PAYMENT_FAILED');

    await app.close();
  });
});