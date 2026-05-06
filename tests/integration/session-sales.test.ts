import { describe, expect, it } from 'vitest';
import { buildServer } from '../../services/lambdas/local-api/src/server';

describe('session and sales endpoints', () => {
  it('creates a session and lists active sales', async () => {
    const app = await buildServer();

    const sessionResponse = await app.inject({
      method: 'POST',
      url: '/sessions',
      payload: { displayName: 'Jim' }
    });

    expect(sessionResponse.statusCode).toBe(200);
    const session = sessionResponse.json();
    expect(session.userToken).toMatch(/^usr_tok_/);
    expect(session.displayName).toBe('Jim');

    const salesResponse = await app.inject({
      method: 'GET',
      url: '/sales',
      headers: { 'x-user-token': session.userToken }
    });

    expect(salesResponse.statusCode).toBe(200);
    expect(salesResponse.json().items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ saleId: 'sale_sneaker_001', status: 'active' }),
        expect.objectContaining({ saleId: 'sale_jacket_002', status: 'active' }),
        expect.objectContaining({ saleId: 'sale_cap_003', status: 'upcoming' }),
        expect.objectContaining({ saleId: 'sale_watch_004', status: 'ended' })
      ])
    );
  });

  it('lists active sales with remaining Redis stock', async () => {
    const originalTtl = process.env.DEFAULT_RESERVATION_TTL_SECONDS;
    delete process.env.DEFAULT_RESERVATION_TTL_SECONDS;

    const app = await buildServer();

    try {
      const salesResponse = await app.inject({
        method: 'GET',
        url: '/sales'
      });

      expect(salesResponse.statusCode).toBe(200);
      expect(salesResponse.json().items).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            saleId: 'sale_sneaker_001',
            status: 'active',
            remainingStock: 10,
            reservationTtlSeconds: 180
          }),
          expect.objectContaining({
            saleId: 'sale_jacket_002',
            status: 'active',
            remainingStock: 5,
            reservationTtlSeconds: 180
          })
        ])
      );
    } finally {
      if (originalTtl === undefined) {
        delete process.env.DEFAULT_RESERVATION_TTL_SECONDS;
      } else {
        process.env.DEFAULT_RESERVATION_TTL_SECONDS = originalTtl;
      }

      await app.close();
    }
  });
});
