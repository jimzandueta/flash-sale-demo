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

    expect(screen.getByRole('heading', { name: 'Flash Sale' })).toBeDefined();
    expect(window.location.pathname).toBe('/');
    expect(screen.getByLabelText('Your name')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Start shopping' })).toBeDefined();
  });

  it('uses the compact shell panel, smaller page heading, and metric-free list header from the reference design', async () => {
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
      });

    vi.stubGlobal('fetch', fetchMock);

    renderApp('/');

    const landingFrame = screen.getByRole('heading', { name: 'Flash Sale' }).closest('section');
    expect(landingFrame?.style.borderRadius).toBe('1rem');

    fireEvent.change(screen.getByLabelText('Your name'), {
      target: { value: 'Jim' }
    });
    fireEvent.click(screen.getByRole('button', { name: 'Start shopping' }));

    fireEvent.click(await screen.findByRole('button', { name: 'View product' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Add to cart' }));
    fireEvent.click(await screen.findByRole('button', { name: '← Keep shopping' }));

    expect(screen.queryByText('Active sales')).toBeNull();
    expect(screen.getAllByText('In cart')).toHaveLength(1);

    const productListHeading = screen.getByRole('heading', { name: 'Product List' });
    expect(productListHeading.style.fontSize).toBe('clamp(1.15rem, 2.3vw, 1.5rem)');

    const cartBar = screen.getByText('🛒 1 item held').parentElement;
    expect(cartBar?.style.borderRadius).toBe('0.6rem');
  });

  it('holds multiple items, checks them out inline, and returns to purchased product cards', async () => {
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
            },
            {
              saleId: 'sale_jacket_002',
              itemName: 'Track Jacket',
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
          status: 'RESERVED',
          reservationId: 'res_jacket',
          expiresAt: '2026-05-06T10:03:00Z',
          remainingStock: 4
        })
      })
      .mockResolvedValueOnce({
        json: async () => ({
          status: 'PURCHASED',
          reservationId: 'res_jacket',
          purchasedAt: '2026-05-06T10:01:00Z'
        })
      })
      .mockResolvedValueOnce({
        json: async () => ({
          status: 'PURCHASED',
          reservationId: 'res_123',
          purchasedAt: '2026-05-06T10:02:00Z'
        })
      });

    vi.stubGlobal('fetch', fetchMock);

    renderApp('/');

    fireEvent.change(screen.getByLabelText('Your name'), {
      target: { value: 'Jim' }
    });
    fireEvent.click(screen.getByRole('button', { name: 'Start shopping' }));

    expect(await screen.findByRole('heading', { name: 'Product List' })).toBeDefined();
    expect(window.location.pathname).toBe('/products');
    expect(screen.getByText('Limited Sneaker')).toBeDefined();

    fireEvent.click(screen.getAllByRole('button', { name: 'View product' })[0]);
    expect(await screen.findByRole('heading', { name: 'Limited Sneaker', level: 1 })).toBeDefined();
    expect(window.location.pathname).toBe('/products/sale_sneaker_001');

    fireEvent.click(screen.getByRole('button', { name: 'Add to cart' }));
    expect(await screen.findByText('This item is held in your cart')).toBeDefined();
    expect(window.location.pathname).toBe('/products/sale_sneaker_001');

    fireEvent.click(screen.getByRole('button', { name: '← Keep shopping' }));
    expect(await screen.findByRole('heading', { name: 'Product List' })).toBeDefined();
    expect(screen.getByText('🛒 1 item held')).toBeDefined();

    fireEvent.click(screen.getAllByRole('button', { name: 'View product' })[1]);
    expect(await screen.findByRole('heading', { name: 'Track Jacket', level: 1 })).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Add to cart' }));
    expect(await screen.findByText('This item is held in your cart')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Proceed to checkout →' }));

    expect(await screen.findByRole('heading', { name: 'Checkout' })).toBeDefined();
    expect(window.location.pathname).toBe('/checkout');
    expect(screen.getByRole('button', { name: 'Buy Track Jacket →' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Buy Limited Sneaker →' })).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: 'Buy Track Jacket →' }));
    expect(await screen.findByText('res_jacket')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Buy Limited Sneaker →' })).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: 'Buy Limited Sneaker →' }));
    expect(await screen.findByRole('button', { name: 'View order confirmation →' })).toBeDefined();
    expect(screen.queryByRole('heading', { name: 'Payment Confirmation' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'View order confirmation →' }));
    expect(await screen.findByRole('heading', { name: 'Order Confirmation' })).toBeDefined();
    expect(window.location.pathname).toBe('/confirmation');
    expect(screen.getByText('res_123')).toBeDefined();
    expect(screen.getByText('res_jacket')).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: '← Back to products' }));
    expect(await screen.findByRole('heading', { name: 'Product List' })).toBeDefined();
    expect(screen.getAllByText('✓ Already purchased')).toHaveLength(2);
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
