import { describe, expect, it } from 'vitest';
import { createInMemoryReservationEngine } from '../../services/lambdas/shared/src/reservation/InMemoryReservationEngine';

describe('in-memory reservation engine', () => {
  it('reserves stock once per user per sale and blocks oversell', async () => {
    const engine = createInMemoryReservationEngine({
      saleId: 'sale_sneaker_001',
      stock: 1
    });

    const first = await engine.reserve({
      saleId: 'sale_sneaker_001',
      userToken: 'usr_tok_1',
      ttlSeconds: 300,
      now: '2026-05-06T10:00:00Z'
    });

    const duplicate = await engine.reserve({
      saleId: 'sale_sneaker_001',
      userToken: 'usr_tok_1',
      ttlSeconds: 300,
      now: '2026-05-06T10:00:10Z'
    });

    const soldOut = await engine.reserve({
      saleId: 'sale_sneaker_001',
      userToken: 'usr_tok_2',
      ttlSeconds: 300,
      now: '2026-05-06T10:00:20Z'
    });

    expect(first.status).toBe('RESERVED');
    expect(duplicate.status).toBe('ALREADY_RESERVED');
    expect(soldOut.status).toBe('SOLD_OUT');
  });
});