import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchObservabilitySnapshot } from './debugClient';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('frontend debug client', () => {
  it('fetches the observability snapshot with no-store cache semantics', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      json: async () => ({ generatedAt: '2026-05-05T10:00:00.000Z' })
    });
    vi.stubGlobal('fetch', fetchMock);

    await fetchObservabilitySnapshot({
      userToken: 'usr_tok_123',
      page: 'product-list',
      cartCount: 1,
      purchaseCount: 0,
      activeSaleCount: 2,
      userLabel: 'Jim'
    });

    expect(fetchMock).toHaveBeenCalledWith(
      '/debug/observability?page=product-list&cartCount=1&purchaseCount=0&activeSaleCount=2&userLabel=Jim&userToken=usr_tok_123',
      { cache: 'no-store' }
    );
  });
});
