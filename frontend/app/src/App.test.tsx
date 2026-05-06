import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { BrowserRouter, useNavigate } from 'react-router-dom';
import App from './App';

type CancelResolver = (value: { json: () => Promise<{ status: 'CANCELLED' }> }) => void;

afterEach(() => {
  cleanup();
  vi.doUnmock('./storefrontPricing');
  vi.resetModules();
  vi.unstubAllGlobals();
});

describe('App', () => {
  it('uses shared storefront pricing for the landing preview items', async () => {
    vi.stubGlobal('fetch', vi.fn());
    await renderLandingPageWithMockedFounderTeePrice(51);

    expect(screen.getByText('Founder Tee')).toBeDefined();
    expect(screen.getByText('$51')).toBeDefined();
    expect(screen.queryByText('$48')).toBeNull();
  });

  it('renders the landing page as a shopper-facing flash sale entry with visible product prices', async () => {
    vi.stubGlobal('fetch', vi.fn());
    renderAppWithTestNavigator('/');

    expect(screen.getByRole('heading', { level: 2, name: 'Flash Sale' })).toBeDefined();
    expect(screen.getByText('Join the flash sale')).toBeDefined();
    expect(screen.getByText('Founder Tee')).toBeDefined();
    expect(screen.getByText('$48')).toBeDefined();
    expect(screen.getByText('Bookipi Cap')).toBeDefined();
    expect(screen.getByText('$42')).toBeDefined();
    expect(screen.getByText('Signature release with limited stock.')).toBeDefined();
    const emailField = screen.getByLabelText('Email Address') as HTMLInputElement;
    expect(emailField.disabled).toBe(true);

    const enterSaleButton = screen.getByRole('button', { name: 'Enter the sale' }) as HTMLButtonElement;
    expect(enterSaleButton.disabled).toBe(true);
  });

  it('shows the landing page before listing sales', async () => {
    vi.stubGlobal('fetch', vi.fn());
    renderAppWithTestNavigator('/');

    expect(screen.getByRole('heading', { level: 1, name: 'Flash Sale' })).toBeDefined();
    expect(window.location.pathname).toBe('/');
    expect(screen.getByLabelText('Name')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Enter the sale' })).toBeDefined();
  });

  it('shows the shopper header without exposing the raw user token', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        json: async () => ({ userToken: 'usr_tok_123', displayName: 'Jim' })
      })
      .mockResolvedValueOnce({
        json: async () => ({
          items: [
            {
              saleId: 'sale_founder_001',
              itemName: 'Founder Tee',
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
      });

    vi.stubGlobal('fetch', fetchMock);

    renderAppWithTestNavigator('/');

    fireEvent.change(screen.getByLabelText('Name'), {
      target: { value: 'Jim' }
    });
    fireEvent.click(screen.getByRole('button', { name: 'Enter the sale' }));

    expect(await screen.findByText('Bookipi / Flash Sale / Products')).toBeDefined();
    expect(screen.queryByText('usr_tok_123')).toBeNull();
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

    const landingFrame = screen.getByRole('heading', { level: 1, name: 'Flash Sale' }).closest('section');
    expect(landingFrame?.style.borderRadius).toBe('1rem');

    fireEvent.change(screen.getByLabelText('Name'), {
      target: { value: 'Jim' }
    });
    fireEvent.click(screen.getByRole('button', { name: 'Enter the sale' }));

    fireEvent.click(await screen.findByRole('button', { name: 'View product' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Add to cart' }));
    expect(await screen.findByText('This item is held in your cart')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Back to products' }));

    expect(await screen.findByRole('heading', { name: 'Products' })).toBeDefined();
    expect(screen.queryByText('Active sales')).toBeNull();
    expect(screen.getAllByText('In cart')).toHaveLength(1);

    const productListHeading = screen.getByRole('heading', { name: 'Products' });
    expect(productListHeading.style.fontSize).toBe('clamp(1.15rem, 2.3vw, 1.5rem)');

    expect(screen.getByText('Cart')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Go to checkout' })).toBeDefined();
  });

  it('shows the shared cart rail on products and product detail with total and checkout action', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ json: async () => ({ userToken: 'usr_tok_123', displayName: 'Avery' }) })
      .mockResolvedValueOnce({
        json: async () => ({
          items: [
            {
              saleId: 'sale_cap_001',
              itemName: 'Bookipi Cap',
              status: 'active',
              startsAt: '2026-05-06T10:00:00Z',
              endsAt: '2026-05-06T12:00:00Z',
              reservationTtlSeconds: 300
            }
          ]
        })
      })
      .mockResolvedValueOnce({ json: async () => ({ items: [] }) })
      .mockResolvedValueOnce({
        json: async () => ({
          status: 'RESERVED',
          reservationId: 'res_cap',
          expiresAt: '2026-05-06T10:05:00Z',
          remainingStock: 9
        })
      });

    vi.stubGlobal('fetch', fetchMock);

    renderApp('/');
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Avery' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enter the sale' }));

    fireEvent.click(await screen.findByRole('button', { name: 'View product' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add to cart' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Back to products' }));

    expect(await screen.findByText('Cart')).toBeDefined();
    expect(screen.getByText('Total')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Go to checkout' })).toBeDefined();
  });

  it('shows product detail with name and price on one row and add-to-cart in the left content area', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ json: async () => ({ userToken: 'usr_tok_123', displayName: 'Avery' }) })
      .mockResolvedValueOnce({
        json: async () => ({
          items: [
            {
              saleId: 'sale_founder_001',
              itemName: 'Founder Tee',
              status: 'active',
              startsAt: '2026-05-06T10:00:00Z',
              endsAt: '2026-05-06T12:00:00Z',
              reservationTtlSeconds: 300
            }
          ]
        })
      })
      .mockResolvedValueOnce({ json: async () => ({ items: [] }) })
      .mockResolvedValueOnce({
        json: async () => ({
          status: 'RESERVED',
          reservationId: 'res_founder',
          expiresAt: '2026-05-06T10:05:00Z',
          remainingStock: 9
        })
      });

    vi.stubGlobal('fetch', fetchMock);

    renderApp('/');
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Avery' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enter the sale' }));
    fireEvent.click(await screen.findByRole('button', { name: 'View product' }));

    expect(await screen.findByRole('heading', { name: 'Founder Tee', level: 1 })).toBeDefined();
    expect(screen.getByText('$48')).toBeDefined();
    const addToCartButton = screen.getByRole('button', { name: 'Add to cart' });
    const buttonWell = addToCartButton.parentElement as HTMLElement;
    const decisionText = screen.getByText('Reserve before the window closes');
    const actionCard = decisionText.parentElement as HTMLElement;
    expect(actionCard.style.justifyItems).toBe('start');
    expect(buttonWell.style.justifyItems).toBe('end');
    expect(buttonWell.style.maxWidth).toBe('16rem');
    expect(addToCartButton.style.width).toBe('16rem');

    fireEvent.click(addToCartButton);

    expect(await screen.findByText('This item is held in your cart')).toBeDefined();
    expect(screen.getByText('Cart')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Go to checkout' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Back to products' })).toBeDefined();
  });

  it('uses non-zero seeded catalog prices and responsive shared rail layouts', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ json: async () => ({ userToken: 'usr_tok_123', displayName: 'Avery' }) })
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
              startsAt: '2026-05-06T10:15:00Z',
              endsAt: '2026-05-06T12:30:00Z',
              reservationTtlSeconds: 300
            }
          ]
        })
      })
      .mockResolvedValueOnce({ json: async () => ({ items: [] }) })
      .mockResolvedValueOnce({
        json: async () => ({
          status: 'RESERVED',
          reservationId: 'res_sneaker',
          expiresAt: '2026-05-06T10:05:00Z',
          remainingStock: 9
        })
      });

    vi.stubGlobal('fetch', fetchMock);

    renderApp('/');
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Avery' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enter the sale' }));

    expect(await screen.findByText('Limited Sneaker')).toBeDefined();
    expect(screen.getByText('Track Jacket')).toBeDefined();
    expect(screen.queryAllByText('$0')).toHaveLength(0);

    fireEvent.click(screen.getAllByRole('button', { name: 'View product' })[0]);
    fireEvent.click(await screen.findByRole('button', { name: 'Add to cart' }));

    expect(await screen.findByText('Total')).toBeDefined();
    expect(screen.queryAllByText('$0')).toHaveLength(0);

    const productDetailLayout = screen.getByText('Cart').closest('section') as HTMLElement;
    expect(productDetailLayout.style.gridTemplateColumns).toBe('repeat(auto-fit, minmax(280px, 1fr))');

    fireEvent.click(screen.getByRole('button', { name: 'Back to products' }));

    const productListLayout = (await screen.findByText('Cart')).closest('section') as HTMLElement;
    expect(productListLayout.style.gridTemplateColumns).toBe('repeat(auto-fit, minmax(280px, 1fr))');
  });

  it('keeps a newly introduced seeded storefront item priced across list, cart, checkout, and payment surfaces', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ json: async () => ({ userToken: 'usr_tok_123', displayName: 'Avery' }) })
      .mockResolvedValueOnce({
        json: async () => ({
          items: [
            {
              saleId: 'sale_duffel_001',
              itemName: 'Weekend Duffel',
              status: 'active',
              startsAt: '2026-05-06T10:00:00Z',
              endsAt: '2026-05-06T12:00:00Z',
              reservationTtlSeconds: 300
            }
          ]
        })
      })
      .mockResolvedValueOnce({ json: async () => ({ items: [] }) })
      .mockResolvedValueOnce({
        json: async () => ({
          status: 'RESERVED',
          reservationId: 'res_duffel',
          expiresAt: '2026-05-06T10:05:00Z',
          remainingStock: 6
        })
      })
      .mockResolvedValueOnce({
        json: async () => ({
          status: 'PURCHASED',
          reservationId: 'res_duffel',
          purchasedAt: '2026-05-06T10:02:00Z'
        })
      });

    vi.stubGlobal('fetch', fetchMock);

    renderApp('/');
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Avery' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enter the sale' }));

    expect(await screen.findByText('Weekend Duffel')).toBeDefined();
    expect(screen.getByText('$96')).toBeDefined();
    expect(screen.queryAllByText('$0')).toHaveLength(0);

    fireEvent.click(screen.getByRole('button', { name: 'View product' }));

    expect(await screen.findByRole('heading', { name: 'Weekend Duffel', level: 1 })).toBeDefined();
    expect(screen.getByText('$96')).toBeDefined();
    expect(screen.queryAllByText('$0')).toHaveLength(0);

    fireEvent.click(screen.getByRole('button', { name: 'Add to cart' }));

    expect(await screen.findByText('This item is held in your cart')).toBeDefined();
    expect(screen.getAllByText('$96').length).toBeGreaterThan(0);
    expect(screen.queryAllByText('$0')).toHaveLength(0);

    fireEvent.click(screen.getByRole('button', { name: 'Go to checkout' }));

    expect(await screen.findByRole('heading', { name: 'Review your cart' })).toBeDefined();
    expect(screen.getAllByText('$96').length).toBeGreaterThan(0);
    expect(screen.queryAllByText('$0')).toHaveLength(0);

    fireEvent.click(screen.getByRole('button', { name: 'Pay now' }));

    expect(await screen.findByText('Pay for Weekend Duffel')).toBeDefined();
    expect(screen.getAllByText('$96').length).toBeGreaterThan(0);
    expect(screen.queryAllByText('$0')).toHaveLength(0);

    fireEvent.click(screen.getByRole('button', { name: 'Confirm payment' }));

    expect(await screen.findByText('Payment confirmed.')).toBeDefined();
    expect(screen.getAllByText('$96').length).toBeGreaterThan(0);
    expect(screen.queryAllByText('$0')).toHaveLength(0);
  });

  it('does not fall back to $0 for a live catalog item that is not in the seeded landing preview', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ json: async () => ({ userToken: 'usr_tok_123', displayName: 'Avery' }) })
      .mockResolvedValueOnce({
        json: async () => ({
          items: [
            {
              saleId: 'sale_camera_001',
              itemName: 'Collector Camera',
              status: 'active',
              startsAt: '2026-05-06T10:00:00Z',
              endsAt: '2026-05-06T12:00:00Z',
              reservationTtlSeconds: 300,
              price: 135
            }
          ]
        })
      })
      .mockResolvedValueOnce({ json: async () => ({ items: [] }) })
      .mockResolvedValueOnce({
        json: async () => ({
          status: 'RESERVED',
          reservationId: 'res_camera',
          expiresAt: '2026-05-06T10:05:00Z',
          remainingStock: 3
        })
      })
      .mockResolvedValueOnce({
        json: async () => ({
          status: 'PURCHASED',
          reservationId: 'res_camera',
          purchasedAt: '2026-05-06T10:02:00Z'
        })
      });

    vi.stubGlobal('fetch', fetchMock);

    renderApp('/');
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Avery' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enter the sale' }));

    expect(await screen.findByText('Collector Camera')).toBeDefined();
    expect(screen.getByText('$135')).toBeDefined();
    expect(screen.queryAllByText('$0')).toHaveLength(0);

    fireEvent.click(screen.getByRole('button', { name: 'View product' }));
    expect(await screen.findByRole('heading', { name: 'Collector Camera', level: 1 })).toBeDefined();
    expect(screen.getByText('$135')).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: 'Add to cart' }));
    expect(await screen.findByText('This item is held in your cart')).toBeDefined();
    expect(screen.getAllByText('$135').length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole('button', { name: 'Go to checkout' }));
    expect(await screen.findByRole('heading', { name: 'Review your cart' })).toBeDefined();
    expect(screen.getAllByText('$135').length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole('button', { name: 'Pay now' }));
    expect(await screen.findByText('Pay for Collector Camera')).toBeDefined();
    expect(screen.getAllByText('$135').length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole('button', { name: 'Confirm payment' }));
    expect(await screen.findByText('Payment confirmed.')).toBeDefined();
    expect(screen.getAllByText('$135').length).toBeGreaterThan(0);
  });

  it('keeps /confirmation as a usable receipt page for direct navigation after purchase', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ json: async () => ({ userToken: 'usr_tok_123', displayName: 'Avery' }) })
      .mockResolvedValueOnce({
        json: async () => ({
          items: [
            {
              saleId: 'sale_cap_001',
              itemName: 'Bookipi Cap',
              status: 'active',
              startsAt: '2026-05-06T10:00:00Z',
              endsAt: '2026-05-06T12:00:00Z',
              reservationTtlSeconds: 300,
              price: 42
            }
          ]
        })
      })
      .mockResolvedValueOnce({ json: async () => ({ items: [] }) })
      .mockResolvedValueOnce({
        json: async () => ({
          status: 'RESERVED',
          reservationId: 'res_cap',
          expiresAt: '2026-05-06T10:05:00Z',
          remainingStock: 9
        })
      })
      .mockResolvedValueOnce({
        json: async () => ({
          status: 'PURCHASED',
          reservationId: 'res_cap',
          purchasedAt: '2026-05-06T10:02:00Z'
        })
      });

    vi.stubGlobal('fetch', fetchMock);

    renderAppWithTestNavigator('/');
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Avery' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enter the sale' }));
    fireEvent.click(await screen.findByRole('button', { name: 'View product' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add to cart' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Go to checkout' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Pay now' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Confirm payment' }));

    expect(await screen.findByText('Payment confirmed.')).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: 'Test navigate to confirmation' }));

    expect(await screen.findByRole('heading', { name: 'Order confirmed' })).toBeDefined();
    expect(screen.getByText('Bookipi Cap')).toBeDefined();
    expect(screen.getByText('$42')).toBeDefined();
    expect(screen.getByText('res_cap')).toBeDefined();
    expect(screen.getByRole('button', { name: '← Back to products' })).toBeDefined();
  });

  it('renders the products page with prices, equal-size cards, and no top cart bar', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ json: async () => ({ userToken: 'usr_tok_123', displayName: 'Jim' }) })
      .mockResolvedValueOnce({
        json: async () => ({
          items: [
            {
              saleId: 'sale_cap_001',
              itemName: 'Bookipi Cap',
              status: 'active',
              startsAt: '2026-05-06T10:00:00Z',
              endsAt: '2026-05-06T12:00:00Z',
              reservationTtlSeconds: 300
            },
            {
              saleId: 'sale_hoodie_001',
              itemName: 'Bookipi Hoodie',
              status: 'upcoming',
              startsAt: '2026-05-06T12:40:00Z',
              endsAt: '2026-05-06T13:00:00Z',
              reservationTtlSeconds: 300
            }
          ]
        })
      })
      .mockResolvedValueOnce({ json: async () => ({ items: [] }) });

    vi.stubGlobal('fetch', fetchMock);

    renderApp('/');
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Jim' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enter the sale' }));

    expect(await screen.findByRole('heading', { name: 'Products' })).toBeDefined();
    expect(screen.getByText('$42')).toBeDefined();
    expect(screen.getByText('$64')).toBeDefined();
    expect(screen.queryByText(/item held/i)).toBeNull();

    const activeCard = screen.getByText('Bookipi Cap').closest('article') as HTMLElement;
    const upcomingCard = screen.getByText('Bookipi Hoodie').closest('article') as HTMLElement;

    expect(activeCard.style.background).toBe('rgb(255, 255, 255)');
    expect(upcomingCard.style.background).toBe('rgb(249, 250, 251)');
    expect(upcomingCard.style.boxShadow).toBe('none');
  });

  it('opens a payment modal for one item and then shows an item-level payment confirmation modal', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ json: async () => ({ userToken: 'usr_tok_123', displayName: 'Avery' }) })
      .mockResolvedValueOnce({
        json: async () => ({
          items: [
            {
              saleId: 'sale_cap_001',
              itemName: 'Bookipi Cap',
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
          reservationId: 'res_cap',
          expiresAt: '2026-05-06T10:05:00Z',
          remainingStock: 9
        })
      })
      .mockResolvedValueOnce({
        json: async () => ({
          status: 'PURCHASED',
          reservationId: 'res_cap',
          purchasedAt: '2026-05-06T10:02:00Z'
        })
      });

    vi.stubGlobal('fetch', fetchMock);

    renderApp('/');

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Avery' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enter the sale' }));
    fireEvent.click(await screen.findByRole('button', { name: 'View product' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add to cart' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Go to checkout' }));

    fireEvent.click(await screen.findByRole('button', { name: 'Pay now' }));

    expect(await screen.findByText('Pay for Bookipi Cap')).toBeDefined();
    expect(screen.getByText('**** **** **** 4242')).toBeDefined();
    expect(screen.getByText('****')).toBeDefined();
    expect(screen.getByText('Name')).toBeDefined();
    expect(screen.getAllByText('Avery')).toHaveLength(2);
    expect(screen.getByRole('button', { name: 'Confirm payment' })).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: 'Confirm payment' }));

    expect(await screen.findByText('Payment confirmed.')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Close' })).toBeDefined();
  });

  it('returns to checkout after closing the payment confirmation modal instead of routing to a full-page confirmation', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ json: async () => ({ userToken: 'usr_tok_123', displayName: 'Jim' }) })
      .mockResolvedValueOnce({
        json: async () => ({
          items: [
            {
              saleId: 'sale_cap_001',
              itemName: 'Bookipi Cap',
              status: 'active',
              startsAt: '2026-05-06T10:00:00Z',
              endsAt: '2026-05-06T12:00:00Z',
              reservationTtlSeconds: 300
            }
          ]
        })
      })
      .mockResolvedValueOnce({ json: async () => ({ items: [] }) })
      .mockResolvedValueOnce({
        json: async () => ({
          status: 'RESERVED',
          reservationId: 'res_cap',
          expiresAt: '2026-05-06T10:05:00Z',
          remainingStock: 9
        })
      })
      .mockResolvedValueOnce({
        json: async () => ({
          status: 'PURCHASED',
          reservationId: 'res_cap',
          purchasedAt: '2026-05-06T10:02:00Z'
        })
      });

    vi.stubGlobal('fetch', fetchMock);

    renderApp('/');
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Jim' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enter the sale' }));
    fireEvent.click(await screen.findByRole('button', { name: 'View product' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add to cart' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Go to checkout' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Pay now' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Confirm payment' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Close' }));

    expect(window.location.pathname).toBe('/checkout');
    expect(screen.queryByRole('heading', { name: 'Order confirmed' })).toBeNull();
  });

  it('renders checkout rows with sale window on the left and remove plus pay actions on the right', async () => {
    const mockedSale = {
      saleId: 'sale_cap_001',
      itemName: 'Bookipi Cap',
      status: 'active',
      startsAt: '2026-05-06T11:15:00Z',
      endsAt: '2026-05-06T13:45:00Z',
      reservationTtlSeconds: 300
    };

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ json: async () => ({ userToken: 'usr_tok_123', displayName: 'Jim' }) })
      .mockResolvedValueOnce({
        json: async () => ({
          items: [mockedSale]
        })
      })
      .mockResolvedValueOnce({ json: async () => ({ items: [] }) })
      .mockResolvedValueOnce({
        json: async () => ({
          status: 'RESERVED',
          reservationId: 'res_cap',
          expiresAt: '2026-05-06T10:05:00Z',
          remainingStock: 9
        })
      });

    vi.stubGlobal('fetch', fetchMock);

    renderApp('/');
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Jim' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enter the sale' }));
    fireEvent.click(await screen.findByRole('button', { name: 'View product' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add to cart' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Go to checkout' }));

    const checkoutRow = screen.getByText('Bookipi Cap').closest('article') as HTMLElement;
    const expectedWindow = formatWindow(mockedSale.startsAt, mockedSale.endsAt);
    const saleWindow = await within(checkoutRow).findByText(expectedWindow);
    const bottomRow = saleWindow.parentElement as HTMLElement;
    const actions = within(bottomRow).getAllByRole('button');

    expect(within(bottomRow).getByText(expectedWindow)).toBeDefined();
    expect(actions.map((button) => button.textContent)).toEqual(['Remove from cart', 'Pay now']);
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

    fireEvent.change(screen.getByLabelText('Name'), {
      target: { value: 'Jim' }
    });
    fireEvent.click(screen.getByRole('button', { name: 'Enter the sale' }));
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

    fireEvent.change(screen.getByLabelText('Name'), {
      target: { value: 'Jim' }
    });
    fireEvent.click(screen.getByRole('button', { name: 'Enter the sale' }));

    fireEvent.click((await screen.findAllByRole('button', { name: 'View product' }))[0]);
    fireEvent.click(screen.getByRole('button', { name: 'Add to cart' }));
    expect(await screen.findByText('This item is held in your cart')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Back to products' }));

    fireEvent.click((await screen.findAllByRole('button', { name: 'View product' }))[1]);
    fireEvent.click(screen.getByRole('button', { name: 'Add to cart' }));
    expect(await screen.findByText('This item is held in your cart')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Go to checkout' }));
    fireEvent.click(
      within(screen.getByText('Track Jacket').closest('article') as HTMLElement).getByRole('button', {
        name: 'Pay now'
      })
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Confirm payment' }));

    expect(
      await screen.findByText('Track Jacket expired before checkout. The cart has been refreshed.')
    ).toBeDefined();
    expect(screen.queryByText('Pay for Track Jacket')).toBeNull();
    expect(screen.queryByText('Track Jacket')).toBeNull();
    expect(screen.getByRole('button', { name: 'Pay now' })).toBeDefined();
  });

  it('keeps both reserved items removed when checkout removals resolve out of order', async () => {
    let resolveFirstCancel: CancelResolver | null = null;
    let resolveSecondCancel: CancelResolver | null = null;

    const fetchMock = vi.fn((input: string | URL | Request, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.pathname : input.url;
      const method = init?.method ?? 'GET';

      if (url === '/sessions' && method === 'POST') {
        return Promise.resolve({ json: async () => ({ userToken: 'usr_tok_123', displayName: 'Jim' }) });
      }

      if (url === '/sales' && method === 'GET') {
        return Promise.resolve({
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
        });
      }

      if (url === '/reservations' && method === 'GET') {
        return Promise.resolve({ json: async () => ({ items: [] }) });
      }

      if (url === '/sales/sale_sneaker_001/reservations' && method === 'POST') {
        return Promise.resolve({
          json: async () => ({
            status: 'RESERVED',
            reservationId: 'res_sneaker',
            expiresAt: '2026-05-06T10:05:00Z',
            remainingStock: 9
          })
        });
      }

      if (url === '/sales/sale_jacket_002/reservations' && method === 'POST') {
        return Promise.resolve({
          json: async () => ({
            status: 'RESERVED',
            reservationId: 'res_jacket',
            expiresAt: '2026-05-06T10:03:00Z',
            remainingStock: 4
          })
        });
      }

      if (url === '/reservations/res_sneaker' && method === 'DELETE') {
        return new Promise((resolve) => {
          resolveFirstCancel = resolve;
        });
      }

      if (url === '/reservations/res_jacket' && method === 'DELETE') {
        return new Promise((resolve) => {
          resolveSecondCancel = resolve;
        });
      }

      throw new Error(`Unexpected fetch: ${method} ${url}`);
    });

    vi.stubGlobal('fetch', fetchMock);

    renderApp('/');

    fireEvent.change(screen.getByLabelText('Name'), {
      target: { value: 'Jim' }
    });
    fireEvent.click(screen.getByRole('button', { name: 'Enter the sale' }));

    fireEvent.click((await screen.findAllByRole('button', { name: 'View product' }))[0]);
    fireEvent.click(screen.getByRole('button', { name: 'Add to cart' }));
    expect(await screen.findByText('This item is held in your cart')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Back to products' }));

    fireEvent.click((await screen.findAllByRole('button', { name: 'View product' }))[1]);
    fireEvent.click(screen.getByRole('button', { name: 'Add to cart' }));
    expect(await screen.findByText('This item is held in your cart')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Go to checkout' }));

    const sneakerRow = screen.getByText('Limited Sneaker').closest('article') as HTMLElement;
    const jacketRow = screen.getByText('Track Jacket').closest('article') as HTMLElement;

    fireEvent.click(within(sneakerRow).getByRole('button', { name: 'Remove from cart' }));
    fireEvent.click(within(jacketRow).getByRole('button', { name: 'Remove from cart' }));

    if (!resolveSecondCancel || !resolveFirstCancel) {
      throw new Error('Expected both pending cancellation handlers to be captured');
    }

    const finishSecondCancel: CancelResolver = resolveSecondCancel;
    const finishFirstCancel: CancelResolver = resolveFirstCancel;

    finishSecondCancel({ json: async () => ({ status: 'CANCELLED' }) });
    await screen.findByText('Limited Sneaker');

    finishFirstCancel({ json: async () => ({ status: 'CANCELLED' }) });

    expect(await screen.findByRole('heading', { name: 'Products' })).toBeDefined();
    expect(window.location.pathname).toBe('/products');
    expect(screen.queryByRole('heading', { name: 'Review your cart' })).toBeNull();
    expect(screen.queryByText('Cart')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Go to checkout' })).toBeNull();
  });

  it('shows payment failures inline inside the payment modal', async () => {
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

    fireEvent.change(screen.getByLabelText('Name'), {
      target: { value: 'Jim' }
    });
    fireEvent.click(screen.getByRole('button', { name: 'Enter the sale' }));
    fireEvent.click(await screen.findByRole('button', { name: 'View product' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add to cart' }));
    expect(await screen.findByText('This item is held in your cart')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Go to checkout' }));

    fireEvent.click(screen.getByRole('button', { name: 'Pay now' }));
    fireEvent.click(screen.getByLabelText('Simulate payment failure'));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm payment' }));

    expect(
      await screen.findByText('Payment failed for Track Jacket. Your hold remains active.')
    ).toBeDefined();
    expect(screen.getByText('Pay for Track Jacket')).toBeDefined();
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

    fireEvent.change(screen.getByLabelText('Name'), {
      target: { value: 'Jim' }
    });
    fireEvent.click(screen.getByRole('button', { name: 'Enter the sale' }));

    fireEvent.click((await screen.findAllByRole('button', { name: 'View product' }))[0]);
    fireEvent.click(screen.getByRole('button', { name: 'Add to cart' }));
    expect(await screen.findByText('This item is held in your cart')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Back to products' }));

    fireEvent.click((await screen.findAllByRole('button', { name: 'View product' }))[1]);
    fireEvent.click(screen.getByRole('button', { name: 'Add to cart' }));
    expect(await screen.findByText('This item is held in your cart')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Go to checkout' }));

    fireEvent.click(
      within(screen.getByText('Limited Sneaker').closest('article') as HTMLElement).getByRole('button', {
        name: 'Pay now'
      })
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Confirm payment' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Close' }));

    await screen.findByText('res_123');
    const remainingButton = screen.getByRole('button', { name: 'Pay now' });
    const receiptCard = screen.getByText('✓ Purchased').closest('article') as HTMLElement;
    const remainingCard = remainingButton.parentElement as HTMLElement;

    expect(
      Boolean(remainingCard.compareDocumentPosition(receiptCard) & Node.DOCUMENT_POSITION_FOLLOWING)
    ).toBe(true);

    fireEvent.click(remainingButton);
    fireEvent.click(await screen.findByRole('button', { name: 'Confirm payment' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Close' }));
    fireEvent.click(screen.getByRole('button', { name: '← Keep shopping' }));

    const purchasedBanner = (await screen.findAllByText('✓ Already purchased'))[0];
    const purchasedCard = purchasedBanner.parentElement as HTMLElement;
    expect(purchasedBanner.style.background).toBe('rgb(224, 240, 255)');
    expect(purchasedBanner.style.color).toBe('rgb(9, 90, 233)');
    expect(within(purchasedCard).getByRole('button', { name: 'View product' })).toBeDefined();
    expect(within(purchasedCard).queryByRole('button', { name: 'Already purchased' })).toBeNull();
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

function renderAppWithTestNavigator(pathname: string) {
  window.history.replaceState({}, '', pathname);

  return render(
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <App />
      <TestNavigator />
    </BrowserRouter>
  );
}

function TestNavigator() {
  const navigate = useNavigate();

  return (
    <button type="button" onClick={() => navigate('/confirmation')}>
      Test navigate to confirmation
    </button>
  );
}

async function renderLandingPageWithMockedFounderTeePrice(price: number) {
  vi.resetModules();

  vi.doMock('./storefrontPricing', async () => {
    const actual = await vi.importActual<typeof import('./storefrontPricing')>('./storefrontPricing');

    return {
      ...actual,
      priceForItem: (itemName: string) => (itemName === 'Founder Tee' ? price : actual.priceForItem(itemName))
    };
  });

  const { LandingPage } = await import('./pages/LandingPage');

  return render(
    <LandingPage
      session={null}
      notice={null}
      draftDisplayName=""
      isCreatingSession={false}
      onDisplayNameChange={() => {}}
      onSubmit={() => {}}
    />
  );
}

function formatWindow(startsAt: string, endsAt: string) {
  const fmt = (value: string) => new Date(value).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  return `${fmt(startsAt)} - ${fmt(endsAt)}`;
}
