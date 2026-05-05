import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import App from './App';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('App', () => {
  it('shows the landing page before listing sales', async () => {
    vi.stubGlobal('fetch', vi.fn());
    renderApp('/');

    expect(screen.getByRole('heading', { name: 'Flash Sale Control Room' })).toBeDefined();
    expect(window.location.pathname).toBe('/');
    expect(screen.getByLabelText('Display name')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Start shopping' })).toBeDefined();
  });

  it('moves through product list, product page, checkout, payment confirmation, and order confirmation', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        json: async () => ({ userToken: 'usr_tok_123', displayName: 'Jim' })
      })
      .mockResolvedValueOnce({
        json: async () => ({
          items: [
            {
              saleId: 'sale_sneaker_001',
              itemName: 'Limited Sneaker',
              status: 'active',
              startsAt: '2026-05-06T10:00:00Z',
              endsAt: '2026-05-06T12:00:00Z',
              reservationTtlSeconds: 300
            }
          ]
        })
      })
      .mockResolvedValueOnce({
        json: async () => ({ items: [] })
      })
      .mockResolvedValueOnce({
        json: async () => ({
          status: 'RESERVED',
          reservationId: 'res_123',
          expiresAt: '2026-05-06T10:05:00Z',
          remainingStock: 9
        })
      })
      .mockResolvedValueOnce({
        json: async () => ({
          status: 'PURCHASED',
          reservationId: 'res_123',
          purchasedAt: '2026-05-06T10:01:00Z'
        })
      });

    vi.stubGlobal('fetch', fetchMock);

    renderApp('/');

    fireEvent.change(screen.getByLabelText('Display name'), {
      target: { value: 'Jim' }
    });
    fireEvent.click(screen.getByRole('button', { name: 'Start shopping' }));

    expect(await screen.findByRole('heading', { name: 'Product List' })).toBeDefined();
    expect(window.location.pathname).toBe('/products');
    expect(screen.getByText('Limited Sneaker')).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: 'View product' }));
    expect(await screen.findByRole('heading', { name: 'Product Page' })).toBeDefined();
    expect(window.location.pathname).toBe('/products/sale_sneaker_001');

    fireEvent.click(screen.getByRole('button', { name: 'Add to cart' }));
    expect(await screen.findByRole('heading', { name: 'Checkout' })).toBeDefined();
    expect(window.location.pathname).toBe('/checkout');

    fireEvent.click(screen.getByRole('button', { name: 'Confirm payment' }));
    expect(await screen.findByRole('heading', { name: 'Payment Confirmation' })).toBeDefined();
    expect(window.location.pathname).toBe('/payment-confirmation');

    fireEvent.click(screen.getByRole('button', { name: 'View order confirmation' }));
    expect(await screen.findByRole('heading', { name: 'Order Confirmation' })).toBeDefined();
    expect(window.location.pathname).toBe('/confirmation');
    expect(screen.getByText('res_123')).toBeDefined();
  });
});

function renderApp(pathname: string) {
  window.history.replaceState({}, '', pathname);

  return render(
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <App />
    </BrowserRouter>
  );
}