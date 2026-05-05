import { afterEach, describe, expect, it, vi } from 'vitest';
import { cancelReservation } from './client';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('frontend API client', () => {
  it('cancels a reservation with DELETE and the user token header', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      json: async () => ({ status: 'CANCELLED' })
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await cancelReservation('res_123', 'usr_tok_123');

    expect(result).toEqual({ status: 'CANCELLED' });
    expect(fetchMock).toHaveBeenCalledWith('/reservations/res_123', {
      method: 'DELETE',
      headers: { 'x-user-token': 'usr_tok_123' }
    });
  });
});
