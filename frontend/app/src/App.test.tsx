import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
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

    const productListHeading = screen.getByRole('heading', { name: 'Available drops' });
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

    expect(await screen.findByRole('heading', { name: 'Available drops' })).toBeDefined();
    expect(window.location.pathname).toBe('/products');
    expect(screen.getByText('Limited Sneaker')).toBeDefined();

    fireEvent.click(screen.getAllByRole('button', { name: 'View product' })[0]);
    expect(await screen.findByRole('heading', { name: 'Limited Sneaker', level: 1 })).toBeDefined();
    expect(window.location.pathname).toBe('/products/sale_sneaker_001');

    fireEvent.click(screen.getByRole('button', { name: 'Add to cart' }));
    expect(await screen.findByText('This item is held in your cart')).toBeDefined();
    expect(window.location.pathname).toBe('/products/sale_sneaker_001');

    fireEvent.click(screen.getByRole('button', { name: '← Keep shopping' }));
    expect(await screen.findByRole('heading', { name: 'Available drops' })).toBeDefined();
    expect(screen.getByText('🛒 1 item held')).toBeDefined();

    fireEvent.click(screen.getAllByRole('button', { name: 'View product' })[1]);
    expect(await screen.findByRole('heading', { name: 'Track Jacket', level: 1 })).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Add to cart' }));
    expect(await screen.findByText('This item is held in your cart')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Proceed to checkout →' }));

    expect(await screen.findByRole('heading', { name: 'Review your cart' })).toBeDefined();
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
    expect(await screen.findByRole('heading', { name: 'Order confirmed' })).toBeDefined();
    expect(window.location.pathname).toBe('/confirmation');
    expect(screen.getByText('res_123')).toBeDefined();
    expect(screen.getByText('res_jacket')).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: '← Back to products' }));
    expect(await screen.findByRole('heading', { name: 'Available drops' })).toBeDefined();
    expect(screen.getAllByText('✓ Already purchased')).toHaveLength(2);
  });

  it('recovers the active hold after ALREADY_RESERVED when local cart state is stale', async () => {
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
        json: async () => ({ status: 'ALREADY_RESERVED' })
      })
      .mockResolvedValueOnce({
        json: async () => ({
          items: [
            {
              reservationId: 'res_existing',
              saleId: 'sale_sneaker_001',
              userToken: 'usr_tok_123',
              status: 'RESERVED',
              expiresAt: '2026-05-06T10:05:00Z'
            }
          ]
        })
      });

    vi.stubGlobal('fetch', fetchMock);

    renderApp('/');

    fireEvent.change(screen.getByLabelText('Your name'), {
      target: { value: 'Jim' }
    });
    fireEvent.click(screen.getByRole('button', { name: 'Start shopping' }));
    fireEvent.click(await screen.findByRole('button', { name: 'View product' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add to cart' }));

    expect(await screen.findByText('This item is held in your cart')).toBeDefined();
    expect(screen.getByText('You already have an active hold for this product.')).toBeDefined();
  });

  it('drops an expired hold from checkout after the backend refreshes active reservations', async () => {
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
        json: async () => ({ status: 'RESERVATION_EXPIRED', reservationId: 'res_jacket' })
      })
      .mockResolvedValueOnce({
        json: async () => ({
          items: [
            {
              reservationId: 'res_123',
              saleId: 'sale_sneaker_001',
              userToken: 'usr_tok_123',
              status: 'RESERVED',
              expiresAt: '2026-05-06T10:05:00Z'
            }
          ]
        })
      });

    vi.stubGlobal('fetch', fetchMock);

    renderApp('/');

    fireEvent.change(screen.getByLabelText('Your name'), {
      target: { value: 'Jim' }
    });
    fireEvent.click(screen.getByRole('button', { name: 'Start shopping' }));

    fireEvent.click((await screen.findAllByRole('button', { name: 'View product' }))[0]);
    fireEvent.click(screen.getByRole('button', { name: 'Add to cart' }));
    expect(await screen.findByText('This item is held in your cart')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: '← Keep shopping' }));

    fireEvent.click((await screen.findAllByRole('button', { name: 'View product' }))[1]);
    fireEvent.click(screen.getByRole('button', { name: 'Add to cart' }));
    expect(await screen.findByText('This item is held in your cart')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Proceed to checkout →' }));
    fireEvent.click(screen.getByRole('button', { name: 'Buy Track Jacket →' }));

    expect(
      await screen.findByText('Track Jacket expired before checkout. The cart has been refreshed.')
    ).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Buy Track Jacket →' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Buy Limited Sneaker →' })).toBeDefined();
  });

  it('shows payment failures inline on the affected checkout item', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        json: async () => ({ userToken: 'usr_tok_123', displayName: 'Jim' })
      })
      .mockResolvedValueOnce({
        json: async () => ({
          items: [
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
          reservationId: 'res_jacket',
          expiresAt: '2026-05-06T10:03:00Z',
          remainingStock: 4
        })
      })
      .mockResolvedValueOnce({
        json: async () => ({ status: 'PAYMENT_FAILED', reservationId: 'res_jacket' })
      });

    vi.stubGlobal('fetch', fetchMock);

    renderApp('/');

    fireEvent.change(screen.getByLabelText('Your name'), {
      target: { value: 'Jim' }
    });
    fireEvent.click(screen.getByRole('button', { name: 'Start shopping' }));
    fireEvent.click(await screen.findByRole('button', { name: 'View product' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add to cart' }));
    expect(await screen.findByText('This item is held in your cart')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Proceed to checkout →' }));

    fireEvent.click(screen.getByLabelText('Simulate payment failure'));
    const buyButton = screen.getByRole('button', { name: 'Buy Track Jacket →' });
    fireEvent.click(buyButton);

    const checkoutCard = await screen.findByRole('button', { name: 'Buy Track Jacket →' });
    expect(
      within(checkoutCard.parentElement as HTMLElement).getByText(
        'Payment failed for Track Jacket. Your hold remains active.'
      )
    ).toBeDefined();
  });

  it('keeps a purchased receipt inline with the checkout sort order and returns blue purchased cards on the product list', async () => {
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
          reservationId: 'res_123',
          purchasedAt: '2026-05-06T10:02:00Z'
        })
      })
      .mockResolvedValueOnce({
        json: async () => ({
          status: 'PURCHASED',
          reservationId: 'res_jacket',
          purchasedAt: '2026-05-06T10:01:00Z'
        })
      });

    vi.stubGlobal('fetch', fetchMock);

    renderApp('/');

    fireEvent.change(screen.getByLabelText('Your name'), {
      target: { value: 'Jim' }
    });
    fireEvent.click(screen.getByRole('button', { name: 'Start shopping' }));

    fireEvent.click((await screen.findAllByRole('button', { name: 'View product' }))[0]);
    fireEvent.click(screen.getByRole('button', { name: 'Add to cart' }));
    expect(await screen.findByText('This item is held in your cart')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: '← Keep shopping' }));

    fireEvent.click((await screen.findAllByRole('button', { name: 'View product' }))[1]);
    fireEvent.click(screen.getByRole('button', { name: 'Add to cart' }));
    expect(await screen.findByText('This item is held in your cart')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Proceed to checkout →' }));

    fireEvent.click(screen.getByRole('button', { name: 'Buy Limited Sneaker →' }));

    await screen.findByText('res_123');
    const remainingButton = screen.getByRole('button', { name: 'Buy Track Jacket →' });
    const receiptCard = screen.getByText('✓ Purchased').parentElement as HTMLElement;
    const remainingCard = remainingButton.parentElement as HTMLElement;

    expect(
      Boolean(remainingCard.compareDocumentPosition(receiptCard) & Node.DOCUMENT_POSITION_FOLLOWING)
    ).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: 'Buy Track Jacket →' }));
    fireEvent.click(await screen.findByRole('button', { name: 'View order confirmation →' }));
    fireEvent.click(await screen.findByRole('button', { name: '← Back to products' }));

    const purchasedBanner = (await screen.findAllByText('✓ Already purchased'))[0];
    expect(purchasedBanner.style.background).toBe('rgb(224, 240, 255)');
    expect(purchasedBanner.style.color).toBe('rgb(9, 90, 233)');
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
