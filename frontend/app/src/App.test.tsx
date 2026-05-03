import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import App from './App';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('App', () => {
  it('shows the display name gate before listing sales', async () => {
    vi.stubGlobal('fetch', vi.fn());
    render(<App />);
    expect(screen.getByLabelText('Display name')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Start shopping' })).toBeDefined();
  });

  it('creates a session and renders the sales, reservations, and checkout sections', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        json: async () => ({ userToken: 'usr_tok_123', displayName: 'Jim' })
      })
      .mockResolvedValueOnce({
        json: async () => ({ items: [] })
      })
      .mockResolvedValueOnce({
        json: async () => ({ items: [] })
      });

    vi.stubGlobal('fetch', fetchMock);

    render(<App />);

    fireEvent.change(screen.getByLabelText('Display name'), {
      target: { value: 'Jim' }
    });
    fireEvent.click(screen.getByRole('button', { name: 'Start shopping' }));

    expect(await screen.findByText('Active Sales')).toBeDefined();
    expect(screen.getByText('Reservations')).toBeDefined();
    expect(screen.getByText('Checkout')).toBeDefined();
  });
});