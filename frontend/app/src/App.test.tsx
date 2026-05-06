import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { BrowserRouter, useNavigate } from 'react-router-dom';
import App from './App';

type CancelResolver = (value: { json: () => Promise<{ status: 'CANCELLED' }> }) => void;
type MockJsonResponse = { json: () => Promise<unknown> };

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.doUnmock('./storefrontPricing');
  vi.resetModules();
  vi.unstubAllGlobals();
});

describe('App', () => {
  it('uses shared storefront pricing for backend-driven landing items', async () => {
    vi.resetModules();

    vi.doMock('./storefrontPricing', async () => {
      const actual = await vi.importActual<typeof import('./storefrontPricing')>('./storefrontPricing');

      return {
        ...actual,
        storefrontPrice: (itemName: string, livePrice?: number) =>
          itemName === 'Founder Tee' ? 51 : actual.storefrontPrice(itemName, livePrice)
      };
    });

    const { default: AppWithMockedPricing } = await import('./App');
    vi.stubGlobal(
      'fetch',
      mockLandingSales([
        {
          saleId: 'sale_founder_001',
          itemName: 'Founder Tee',
          status: 'active',
          startsAt: '2026-05-06T10:00:00Z',
          endsAt: '2026-05-06T12:00:00Z',
          reservationTtlSeconds: 300
        }
      ])
    );

    window.history.replaceState({}, '', '/');

    render(
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <AppWithMockedPricing />
      </BrowserRouter>
    );

    expect(await screen.findByText('Founder Tee')).toBeDefined();
    expect(screen.getByText('$51')).toBeDefined();
    expect(screen.queryByText('$48')).toBeNull();
  });

  it('renders the landing page as a shopper-facing flash sale entry with visible product prices', async () => {
    vi.stubGlobal('fetch', mockLandingSales());
    renderAppWithTestNavigator('/');

    expect(await screen.findByRole('heading', { level: 2, name: 'Flash Sale' })).toBeDefined();
    expect(screen.getByText('Join the flash sale')).toBeDefined();
    expect(await screen.findByText('Founder Tee')).toBeDefined();
    expect(screen.getByText('$48')).toBeDefined();
    expect(screen.getByText('KooPiBi Cap')).toBeDefined();
    expect(screen.getByText('$42')).toBeDefined();
    expect(screen.getByText('Heavyweight tee from the founder collection.')).toBeDefined();
    const emailField = screen.getByLabelText('Email Address') as HTMLInputElement;
    expect(emailField.disabled).toBe(false);

    const enterSaleButton = screen.getByRole('button', { name: 'Enter the sale' }) as HTMLButtonElement;
    expect(enterSaleButton.disabled).toBe(true);
  });

  it('renders the landing page full width with hero and form in one row', async () => {
    vi.stubGlobal('fetch', mockLandingSales());

    renderApp('/');

    const shellFrame = screen
      .getByRole('heading', { level: 1, name: 'Limited drops. Short windows. Shop the sale before it is gone.' })
      .closest('section') as HTMLElement;

    expect(screen.getByText('Limited drops. Short windows. Shop the sale before it is gone.')).toBeDefined();
    expect(screen.getByText('Spring drop live now')).toBeDefined();
    expect(await screen.findByText('Founder Tee')).toBeDefined();
    expect(screen.getByText('KooPiBi Cap')).toBeDefined();
    expect(screen.getByText('Join the flash sale')).toBeDefined();
    expect(screen.getByPlaceholderText('Name')).toBeDefined();
    expect(screen.getByPlaceholderText('Email')).toBeDefined();
    expect(screen.queryByText('Disabled')).toBeNull();
    expect(screen.queryByText('Hover')).toBeNull();
    expect(screen.queryByText('Pressed')).toBeNull();
    expect(shellFrame.style.maxWidth).toBe('100%');

    const landingContent = screen.getByText('Join the flash sale').closest('form')?.parentElement as HTMLElement;
    expect(landingContent.style.gridTemplateColumns).toBe('1.05fr 0.95fr');

    const [enterSaleButton] = screen.getAllByRole('button', { name: 'Enter the sale' }) as HTMLButtonElement[];
    expect(screen.getAllByRole('button', { name: 'Enter the sale' })).toHaveLength(1);
    expect(enterSaleButton.disabled).toBe(true);
  });

  it('uses the single landing CTA to show disabled and enabled visual states', async () => {
    vi.stubGlobal('fetch', mockLandingSales());

    renderApp('/');

    const enterSaleButton = screen.getByRole('button', { name: 'Enter the sale' }) as HTMLButtonElement;
    expect(enterSaleButton.disabled).toBe(true);
    expect(enterSaleButton.style.opacity).toBe('0.75');

    fillLandingForm({ name: 'Jim', email: 'jim@example.com' });

    expect(enterSaleButton.disabled).toBe(false);
    expect(enterSaleButton.style.opacity).toBe('1');
    expect(enterSaleButton.style.background).toBe('linear-gradient(180deg, #6f7cff 0%, #5f6fff 100%)');
  });

  it('requires both name and email before enabling the landing CTA', async () => {
    vi.stubGlobal('fetch', mockLandingSales());

    renderApp('/');

    const nameField = screen.getByPlaceholderText('Name') as HTMLInputElement;
    const emailField = screen.getByPlaceholderText('Email') as HTMLInputElement;
    const enterSaleButton = screen.getByRole('button', { name: 'Enter the sale' }) as HTMLButtonElement;

    expect(emailField.disabled).toBe(false);
    expect(enterSaleButton.disabled).toBe(true);

    fireEvent.change(nameField, {
      target: { value: 'Jim' }
    });

    expect(enterSaleButton.disabled).toBe(true);

    fireEvent.change(emailField, {
      target: { value: 'jim@example.com' }
    });

    expect(enterSaleButton.disabled).toBe(false);
  });

  it('renders only active backend sales on the landing page before session creation', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce({
      json: async () => ({
        items: [
          {
            saleId: 'sale_founder_001',
            itemName: 'Founder Tee',
            status: 'active',
            startsAt: '2026-05-06T10:00:00Z',
            endsAt: '2026-05-06T12:00:00Z',
            reservationTtlSeconds: 300
          },
          {
            saleId: 'sale_cap_001',
            itemName: 'KooPiBi Cap',
            status: 'active',
            startsAt: '2026-05-06T10:00:00Z',
            endsAt: '2026-05-06T12:00:00Z',
            reservationTtlSeconds: 300
          },
          {
            saleId: 'sale_hoodie_001',
            itemName: 'KooPiBi Hoodie',
            status: 'upcoming',
            startsAt: '2026-05-06T12:40:00Z',
            endsAt: '2026-05-06T13:00:00Z',
            reservationTtlSeconds: 300
          }
        ]
      })
    });

    vi.stubGlobal('fetch', fetchMock);

    renderApp('/');

    expect(await screen.findByText('Founder Tee')).toBeDefined();
    expect(screen.getByText('KooPiBi Cap')).toBeDefined();
    expect(screen.queryByText('KooPiBi Hoodie')).toBeNull();
  });

  it('shows a landing empty state when there are no active sales', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce({
      json: async () => ({
        items: [
          {
            saleId: 'sale_hoodie_001',
            itemName: 'KooPiBi Hoodie',
            status: 'upcoming',
            startsAt: '2026-05-06T12:40:00Z',
            endsAt: '2026-05-06T13:00:00Z',
            reservationTtlSeconds: 300
          }
        ]
      })
    });

    vi.stubGlobal('fetch', fetchMock);

    renderApp('/');

    expect(await screen.findByText('No active drops right now.')).toBeDefined();
    expect(screen.queryByText('KooPiBi Hoodie')).toBeNull();
  });

  it('uses the same per-item gradient art on landing tiles and product cards', async () => {
    const fetchMock = vi
      .fn()
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
        json: async () => ({ userToken: 'usr_tok_123', displayName: 'Jim' })
      })
      .mockResolvedValueOnce({
        json: async () => ({ items: [] })
      });

    vi.stubGlobal('fetch', fetchMock);

    renderApp('/');

    const landingTile = (await screen.findByText('Founder Tee')).closest('[style*="min-height: 132px"]') as HTMLElement;
    const landingArt = landingTile.querySelector('[aria-hidden="true"]') as HTMLElement;

    fillLandingForm({ name: 'Jim', email: 'jim@example.com' });
    fireEvent.click(screen.getByRole('button', { name: 'Enter the sale' }));

    expect(await screen.findByText('Products')).toBeDefined();
    const productCard = (await screen.findByText('Founder Tee')).closest('article') as HTMLElement;
    const productArt = productCard.querySelector('[aria-hidden="true"]') as HTMLElement;

    expect(landingArt.style.background).toBe('linear-gradient(135deg, #8ec5fc 0%, #e0c3fc 100%)');
    expect(productArt.style.background).toBe('linear-gradient(135deg, #8ec5fc 0%, #e0c3fc 100%)');
  });

  it('shows the landing page before listing sales', async () => {
    vi.stubGlobal('fetch', mockLandingSales());
    renderAppWithTestNavigator('/');

    expect(
      screen.getByRole('heading', {
        level: 1,
        name: 'Limited drops. Short windows. Shop the sale before it is gone.'
      })
    ).toBeDefined();
    expect(window.location.pathname).toBe('/');
    expect(screen.getByLabelText('Name')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Enter the sale' })).toBeDefined();
  });

  it('does not request observability before a shopper session exists', async () => {
    const fetchMock = mockLandingSales();
    vi.stubGlobal('fetch', fetchMock);

    renderApp('/');

    expect(await screen.findByText('Founder Tee')).toBeDefined();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith('/sales');
  });

  it('renders the developer dock on landing even when no observability snapshot exists yet', async () => {
    const fetchMock = mockLandingSales();
    vi.stubGlobal('fetch', fetchMock);

    renderApp('/');

    expect(await screen.findByText('Founder Tee')).toBeDefined();

    fireEvent.change(screen.getByPlaceholderText('Name'), {
      target: { value: 'Jim' }
    });

    const dock = screen.getByText('Developer dock').closest('section') as HTMLElement;
    const dockQueries = within(dock);

    expect(screen.queryByText('Behind the scenes')).toBeNull();
    expect(dockQueries.getByText('landing')).toBeDefined();
    expect(dockQueries.getByText('2')).toBeDefined();
    expect(dockQueries.getByText('Session')).toBeDefined();
    expect(dockQueries.getByText('n/a')).toBeDefined();
    expect(dockQueries.queryByText('Jim')).toBeNull();
    expect(dockQueries.getByText('Observability data unavailable.')).toBeDefined();
  });

  it('renders the fallback session label in the developer dock without the Session prefix', async () => {
    const fetchMock = vi.fn((input: string | URL | Request, init?: RequestInit) => {
      const url = normalizeRequestPath(input);
      const method = init?.method ?? 'GET';

      if (url === '/sales' && method === 'GET') {
        return Promise.resolve(
          jsonResponse({
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
        );
      }

      if (url === '/sessions' && method === 'POST') {
        return Promise.resolve(jsonResponse({ userToken: 'usr_tok_123', displayName: 'Jim' }));
      }

      if (url === '/reservations' && method === 'GET') {
        return Promise.resolve(jsonResponse({ items: [] }));
      }

      if (url.startsWith('/debug/observability')) {
        return Promise.reject(new Error('Observability unavailable'));
      }

      throw new Error(`Unexpected fetch: ${method} ${url}`);
    });

    vi.stubGlobal('fetch', fetchMock);

    renderApp('/');

    fillLandingForm({ name: 'Jim', email: 'jim@example.com' });
    fireEvent.click(screen.getByRole('button', { name: 'Enter the sale' }));

    expect(await screen.findByRole('heading', { name: 'Products' })).toBeDefined();

    const dock = screen.getByText('Developer dock').closest('section') as HTMLElement;
    const dockQueries = within(dock);

    await waitFor(() => expect(dockQueries.getByText('Observability data unavailable.')).toBeDefined());
    expect(dockQueries.getByText('Session')).toBeDefined();
    expect(dockQueries.getByText('usr_tok_123')).toBeDefined();
    expect(dockQueries.queryByText('Session: usr_tok_123')).toBeNull();
  });

  it('shows the shopper header without exposing the raw user token', async () => {
    const fetchMock = mockShopperEntryFetch({
      displayName: 'Jim',
      sales: [
        {
          saleId: 'sale_founder_001',
          itemName: 'Founder Tee',
          status: 'active',
          startsAt: '2026-05-06T10:00:00Z',
          endsAt: '2026-05-06T12:00:00Z',
          reservationTtlSeconds: 300
        }
      ]
    }).mockResolvedValueOnce({
      json: async () => ({ status: 'CANCELLED' })
    });

    vi.stubGlobal('fetch', fetchMock);

    renderAppWithTestNavigator('/');

    fillLandingForm({ name: 'Jim', email: 'jim@example.com' });
    fireEvent.click(screen.getByRole('button', { name: 'Enter the sale' }));

    const shopperHeader = (await screen.findByText('KooPiBi / Flash Sale / Products')).closest('header') as HTMLElement;

    expect(within(shopperHeader).getByText('Products')).toBeDefined();
    expect(within(shopperHeader).queryByText('usr_tok_123')).toBeNull();
  });

  it('shows the review-3 products header with no raw token or flow steps', async () => {
    const fetchMock = mockShopperEntryFetch({
      displayName: 'Jim',
      sales: [
        {
          saleId: 'sale_founder_001',
          itemName: 'Founder Tee',
          status: 'active',
          startsAt: '2026-05-06T10:00:00Z',
          endsAt: '2026-05-06T12:00:00Z',
          reservationTtlSeconds: 300
        }
      ]
    });

    vi.stubGlobal('fetch', fetchMock);

    renderApp('/');

    fillLandingForm({ name: 'Jim', email: 'jim@example.com' });
    fireEvent.click(screen.getByRole('button', { name: 'Enter the sale' }));

    const shopperShell = (await screen.findByRole('heading', { name: 'Products' })).closest('section') as HTMLElement;
    const shopperQueries = within(shopperShell);

    expect(shopperQueries.getByText('KooPiBi / Flash Sale / Products')).toBeDefined();
    expect(shopperQueries.getByText('Limited drops with short sale windows.')).toBeDefined();
    expect(shopperQueries.queryByText('Landing')).toBeNull();
    expect(shopperQueries.queryByText('Checkout')).toBeNull();
    expect(shopperQueries.queryByText('Confirm')).toBeNull();
    expect(shopperQueries.queryByText('Session')).toBeNull();
    expect(shopperQueries.queryByText('usr_tok_123')).toBeNull();
  });

  it('renders the developer dock summary with the approved Task 2 labels and order', async () => {
    const fetchMock = vi
      .fn()
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
        json: async () => ({ userToken: 'usr_tok_123', displayName: 'Jim' })
      })
      .mockResolvedValueOnce({
        json: async () => ({ items: [] })
      })
      .mockResolvedValueOnce({
        json: async () => ({
          generatedAt: '2026-05-05T10:00:00.000Z',
          workerMode: 'manual',
          shopper: { userToken: 'usr_tok_123', displayName: 'Jim' },
          app: {
            page: 'product-list',
            cartCount: 0,
            purchaseCount: 0,
            activeSaleCount: 1,
            userLabel: 'Jim',
            pendingSqsCount: 1
          },
          pipeline: [],
          redis: { status: 'ok', stockBySale: [], userReservationIds: [], reservations: [], expiryQueues: [] },
          sqs: { status: 'ok', queues: [] },
          dynamodb: { status: 'ok', tableName: 'flash-sale-reservations-local', shopperRecords: [] },
          manualWorker: {}
        })
      });

    vi.stubGlobal('fetch', fetchMock);

    renderApp('/');

    fillLandingForm({ name: 'Jim', email: 'jim@example.com' });
    fireEvent.click(screen.getByRole('button', { name: 'Enter the sale' }));

    expect(await screen.findByText('Products')).toBeDefined();

    const dock = screen.getByText('Developer dock').closest('section');
    expect(dock).not.toBeNull();

    const dockQueries = within(dock as HTMLElement);
    const summaryGrid = (dock as HTMLElement).children[1] as HTMLElement;
    const summaryQueries = within(summaryGrid);
    const summaryLabels = Array.from(summaryGrid.children).map(
      (cell) => (cell as HTMLElement).children[0]?.textContent
    );

    expect(dockQueries.queryByText('Behind the scenes')).toBeNull();
    expect(summaryLabels).toEqual(['Page', 'Session', 'Worker mode', 'Active sales', 'Cart', 'Purchased']);
    expect(dockQueries.getByText('product-list')).toBeDefined();
    expect(dockQueries.getByText('usr_tok_123')).toBeDefined();
    expect(summaryQueries.queryByText('Session: usr_tok_123')).toBeNull();
    expect(summaryQueries.queryByText('User')).toBeNull();
    expect(summaryQueries.queryByText('Jim')).toBeNull();
    expect(dockQueries.getAllByText('1').length).toBeGreaterThan(0);
    expect(dockQueries.queryByRole('button', { name: 'Open developer dock' })).toBeNull();
    expect(dockQueries.queryByRole('button', { name: 'Close developer dock' })).toBeNull();
    expect(await dockQueries.findByRole('table', { name: 'Redis data' })).toBeDefined();
  });

  it('renders the developer dock expanded by default with visible tables and no toggle controls', async () => {
    const fetchMock = vi
      .fn()
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
        json: async () => ({ userToken: 'usr_tok_123', displayName: 'Jim' })
      })
      .mockResolvedValueOnce({
        json: async () => ({ items: [] })
      })
      .mockResolvedValueOnce({
        json: async () => ({
          generatedAt: '2026-05-05T10:00:00.000Z',
          workerMode: 'manual',
          shopper: { userToken: 'usr_tok_123', displayName: 'Jim' },
          app: {
            page: 'product-list',
            cartCount: 0,
            purchaseCount: 0,
            activeSaleCount: 1,
            userLabel: 'Jim',
            pendingSqsCount: 1
          },
          pipeline: [],
          redis: { status: 'ok', stockBySale: [], userReservationIds: [], reservations: [], expiryQueues: [] },
          sqs: { status: 'ok', queues: [] },
          dynamodb: { status: 'ok', tableName: 'flash-sale-reservations-local', shopperRecords: [] },
          manualWorker: {}
        })
      });

    vi.stubGlobal('fetch', fetchMock);

    renderApp('/');

    fillLandingForm({ name: 'Jim', email: 'jim@example.com' });
    fireEvent.click(screen.getByRole('button', { name: 'Enter the sale' }));

    expect(await screen.findByRole('heading', { name: 'Products' })).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Open developer dock' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Close developer dock' })).toBeNull();
    expect(await screen.findByRole('table', { name: 'Redis data' })).toBeDefined();
    expect(screen.getByRole('table', { name: 'SQS data' })).toBeDefined();
    expect(screen.getByRole('table', { name: 'DynamoDB data' })).toBeDefined();
    expect(screen.getByRole('table', { name: 'Activity' })).toBeDefined();
  });

  it('renders last updated and dock empty-state rows when backend tables are empty', async () => {
    const sales = [
      {
        saleId: 'sale_founder_001',
        itemName: 'Founder Tee',
        status: 'active' as const,
        startsAt: '2026-05-06T10:00:00Z',
        endsAt: '2026-05-06T12:00:00Z',
        reservationTtlSeconds: 300
      }
    ];

    const fetchMock = mockShopperEntryFetch({
      displayName: 'Jim',
      sales,
      observability: {
        ...defaultObservabilitySnapshot({ displayName: 'Jim', sales }),
        generatedAt: '2026-05-05T10:00:00.000Z'
      }
    });

    vi.stubGlobal('fetch', fetchMock);

    renderApp('/');
    fillLandingForm({ name: 'Jim', email: 'jim@example.com' });
    fireEvent.click(screen.getByRole('button', { name: 'Enter the sale' }));

    expect(await screen.findByRole('heading', { name: 'Products' })).toBeDefined();

    expect(screen.getByText('Last updated: 2026-05-05T10:00:00.000Z')).toBeDefined();
    expect(screen.getByRole('table', { name: 'Activity' })).toBeDefined();
    const activity = within(screen.getByRole('table', { name: 'Activity' }));
    expect(activity.getByText('session created')).toBeDefined();
    expect(activity.getByText('navigated to products')).toBeDefined();
    expect(screen.getByText('No Redis records for this shopper or sale set yet.')).toBeDefined();
    expect(screen.getByText('No queue metrics available.')).toBeDefined();
    expect(screen.getByText('No durable shopper records yet.')).toBeDefined();
  });

  it('keeps the current Products page copy while the dock stays always open', async () => {
    const fetchMock = mockShopperEntryFetch({
      displayName: 'Jim',
      sales: [
        {
          saleId: 'sale_founder_001',
          itemName: 'Founder Tee',
          status: 'active' as const,
          startsAt: '2026-05-06T10:00:00Z',
          endsAt: '2026-05-06T12:00:00Z',
          reservationTtlSeconds: 300
        }
      ]
    });

    vi.stubGlobal('fetch', fetchMock);

    renderApp('/');
    fillLandingForm({ name: 'Jim', email: 'jim@example.com' });
    fireEvent.click(screen.getByRole('button', { name: 'Enter the sale' }));

    expect(await screen.findByRole('heading', { name: 'Products' })).toBeDefined();
    expect(screen.queryByText('Available drops')).toBeNull();
    expect(screen.getByText('Developer dock')).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Open developer dock' })).toBeNull();
  });

  it('records frontend dock activity for session creation and opening product detail', async () => {
    const fetchMock = mockShopperEntryFetch({
      displayName: 'Jim',
      sales: [
        {
          saleId: 'sale_founder_001',
          itemName: 'Founder Tee',
          status: 'active',
          startsAt: '2026-05-06T10:00:00Z',
          endsAt: '2026-05-06T12:00:00Z',
          reservationTtlSeconds: 300
        }
      ]
    });

    vi.stubGlobal('fetch', fetchMock);

    renderApp('/');
    fillLandingForm({ name: 'Jim', email: 'jim@example.com' });
    fireEvent.click(screen.getByRole('button', { name: 'Enter the sale' }));

    expect(await screen.findByRole('heading', { name: 'Products' })).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: 'View product' }));

    expect((await screen.findAllByText('Founder Tee')).length).toBeGreaterThan(0);

    const activity = screen.getByRole('table', { name: 'Activity' });
    const activityQueries = within(activity);

    expect(activityQueries.getByText('session created')).toBeDefined();
    expect(activityQueries.getByText('navigated to products')).toBeDefined();
    expect(activityQueries.getByText('opened product detail')).toBeDefined();
  });

  it('records frontend dock activity for opening checkout, opening payment, and confirming payment', async () => {
    const fetchMock = mockShopperEntryFetch({
      displayName: 'Jim',
      sales: [
        {
          saleId: 'sale_founder_001',
          itemName: 'Founder Tee',
          status: 'active',
          startsAt: '2026-05-06T10:00:00Z',
          endsAt: '2026-05-06T12:00:00Z',
          reservationTtlSeconds: 300,
          price: 48,
          remainingStock: 10
        }
      ],
      responses: [
        {
          status: 'RESERVED',
          reservationId: 'res_founder',
          expiresAt: '2026-05-06T10:05:00Z',
          remainingStock: 9
        },
        {
          status: 'PURCHASED',
          reservationId: 'res_founder',
          purchasedAt: '2026-05-06T10:02:00Z'
        }
      ]
    });

    vi.stubGlobal('fetch', fetchMock);

    renderApp('/');
    fillLandingForm({ name: 'Jim', email: 'jim@example.com' });
    fireEvent.click(screen.getByRole('button', { name: 'Enter the sale' }));

    expect(await screen.findByRole('heading', { name: 'Products' })).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: 'View product' }));
    expect(await screen.findByRole('button', { name: 'Add to cart' })).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: 'Add to cart' }));
    expect(await screen.findByText(/added to cart\./i)).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: 'Go to checkout' }));
    expect(await screen.findByRole('heading', { name: 'Review your cart' })).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: 'Pay now' }));
    expect(await screen.findByText('Pay for Founder Tee')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Confirm payment' }));
    expect(await screen.findByText('Payment confirmed.')).toBeDefined();

    const activityQueries = within(screen.getByRole('table', { name: 'Activity' }));
    expect(activityQueries.getByText('opened checkout')).toBeDefined();
    expect(activityQueries.getByText('opened payment')).toBeDefined();
    expect(activityQueries.getByText('confirmed payment')).toBeDefined();
  });

  it('shows Products-era pipeline, activity, and backend tables in the always-open developer dock', async () => {
    const fetchMock = vi
      .fn()
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
        json: async () => ({ userToken: 'usr_tok_123', displayName: 'Jim' })
      })
      .mockResolvedValueOnce({
        json: async () => ({ items: [] })
      })
      .mockResolvedValueOnce({
        json: async () => ({
          generatedAt: '2026-05-05T10:00:00.000Z',
          workerMode: 'manual',
          shopper: { userToken: 'usr_tok_123', displayName: 'Jim' },
          app: {
            page: 'product-list',
            cartCount: 0,
            purchaseCount: 0,
            activeSaleCount: 1,
            userLabel: 'Jim',
            pendingSqsCount: 1
          },
          pipeline: [
            { stage: 'dynamodb', status: 'complete', title: 'DynamoDB', summary: '1 durable record' },
            { stage: 'shopper', status: 'active', title: 'Shopper', summary: 'Jim is active' },
            { stage: 'redis', status: 'complete', title: 'Redis', summary: '1 live reservation' },
            { stage: 'sqs', status: 'waiting', title: 'SQS', summary: '1 queued message' },
            { stage: 'worker', status: 'complete', title: 'Worker', summary: 'Ready for the next poll' }
          ],
          redis: {
            status: 'ok',
            stockBySale: [{ saleId: 'sale_founder_001', stock: 9 }],
            userReservationIds: ['res_1'],
            reservations: [
              {
                reservationId: 'res_1',
                saleId: 'sale_founder_001',
                userToken: 'usr_tok_123',
                status: 'RESERVED',
                expiresAt: '2026-05-05T10:05:00.000Z'
              }
            ],
            expiryQueues: [{ saleId: 'sale_founder_001', size: 1 }]
          },
          sqs: {
            status: 'ok',
            queues: [
              {
                type: 'reservation',
                queueUrl: 'http://localstack:4566/000000000000/dev-reservation-events',
                visibleMessages: 1,
                inFlightMessages: 0
              }
            ]
          },
          dynamodb: {
            status: 'ok',
            tableName: 'flash-sale-reservations-local',
            shopperRecords: [
              {
                reservationId: 'res_1',
                saleId: 'sale_founder_001',
                userToken: 'usr_tok_123',
                status: 'RESERVED',
                updatedAt: '2026-05-05T10:00:00.000Z'
              }
            ]
          },
          manualWorker: {}
        })
      });

    vi.stubGlobal('fetch', fetchMock);

    renderApp('/');
    fillLandingForm({ name: 'Jim', email: 'jim@example.com' });
    fireEvent.click(screen.getByRole('button', { name: 'Enter the sale' }));

    expect(await screen.findByRole('heading', { name: 'Products' })).toBeDefined();
    expect(screen.getByText('manual')).toBeDefined();
    expect(screen.getByText('Processing is paused until you click Process worker now.')).toBeDefined();
    expect(screen.getByText('Last manual run: 2026-05-05T10:00:00.000Z')).toBeDefined();
    expect(screen.getByText('Last updated: 2026-05-05T10:00:00.000Z')).toBeDefined();
    expect(screen.getByText('1 queued message')).toBeDefined();
    expect(await screen.findByText('Shopper')).toBeDefined();

    const pipeline = screen.getByText('Shopper').closest('section') as HTMLElement;
    expect(readPipelineTitles(pipeline)).toEqual(['Shopper', 'Redis', 'SQS', 'Worker', 'DynamoDB']);

    expect(screen.getByRole('table', { name: 'Activity' })).toBeDefined();
    expect(screen.getByRole('table', { name: 'Redis data' })).toBeDefined();
    expect(screen.getByRole('table', { name: 'SQS data' })).toBeDefined();
    expect(screen.getByRole('table', { name: 'DynamoDB data' })).toBeDefined();
    expect(readTableOrder()).toEqual(['Redis data', 'SQS data', 'DynamoDB data', 'Activity']);
  });

  it('shows heartbeat worker mode copy when observability reports heartbeat mode', async () => {
    const sales = [
      {
        saleId: 'sale_founder_001',
        itemName: 'Founder Tee',
        status: 'active' as const,
        startsAt: '2026-05-06T10:00:00Z',
        endsAt: '2026-05-06T12:00:00Z',
        reservationTtlSeconds: 300
      }
    ];

    const fetchMock = mockShopperEntryFetch({
      displayName: 'Jim',
      sales,
      observability: {
        ...defaultObservabilitySnapshot({ displayName: 'Jim', sales }),
        workerMode: 'heartbeat',
        pipeline: [{ stage: 'sqs', status: 'waiting', title: 'SQS', summary: '1 queued message' }],
        app: {
          page: 'product-list',
          cartCount: 0,
          purchaseCount: 0,
          activeSaleCount: 1,
          userLabel: 'Jim',
          pendingSqsCount: 1
        },
        sqs: {
          status: 'ok',
          queues: [
            {
              type: 'reservation',
              queueUrl: 'http://localstack:4566/000000000000/dev-reservation-events',
              visibleMessages: 1,
              inFlightMessages: 0
            }
          ]
        }
      }
    });

    vi.stubGlobal('fetch', fetchMock);

    renderApp('/');
    fillLandingForm({ name: 'Jim', email: 'jim@example.com' });
    fireEvent.click(screen.getByRole('button', { name: 'Enter the sale' }));

    expect(await screen.findByRole('heading', { name: 'Products' })).toBeDefined();
    expect(screen.getByText('heartbeat')).toBeDefined();
    expect(screen.getByText('Background polling is active. Queue counts may change without a manual trigger.')).toBeDefined();
    expect(screen.getByText('Last heartbeat: 2026-05-05T10:00:00.000Z')).toBeDefined();
    expect(screen.getByText('Last updated: 2026-05-05T10:00:00.000Z')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Process worker now' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Refresh' })).toBeDefined();
  });

  it('renders refresh beside process worker and updates the dock from a later snapshot', async () => {
    const fetchMock = vi
      .fn()
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
        json: async () => ({ userToken: 'usr_tok_123', displayName: 'Jim' })
      })
      .mockResolvedValueOnce({
        json: async () => ({ items: [] })
      })
      .mockResolvedValueOnce({
        json: async () => ({
          generatedAt: '2026-05-05T10:00:00.000Z',
          workerMode: 'heartbeat',
          shopper: { userToken: 'usr_tok_123', displayName: 'Jim' },
          app: {
            page: 'product-list',
            cartCount: 0,
            purchaseCount: 0,
            activeSaleCount: 1,
            userLabel: 'Jim',
            pendingSqsCount: 1
          },
          pipeline: [{ stage: 'sqs', status: 'waiting', title: 'SQS', summary: '1 queued message' }],
          redis: { status: 'ok', stockBySale: [], userReservationIds: [], reservations: [], expiryQueues: [] },
          sqs: {
            status: 'ok',
            queues: [
              {
                type: 'reservation',
                queueUrl: 'http://localstack:4566/000000000000/dev-reservation-events',
                visibleMessages: 1,
                inFlightMessages: 0
              }
            ]
          },
          dynamodb: { status: 'ok', tableName: 'flash-sale-reservations-local', shopperRecords: [] },
          manualWorker: {}
        })
      })
      .mockResolvedValueOnce({
        json: async () => ({
          generatedAt: '2026-05-05T10:01:00.000Z',
          workerMode: 'heartbeat',
          shopper: { userToken: 'usr_tok_123', displayName: 'Jim' },
          app: {
            page: 'product-list',
            cartCount: 0,
            purchaseCount: 0,
            activeSaleCount: 1,
            userLabel: 'Jim',
            pendingSqsCount: 0
          },
          pipeline: [{ stage: 'dynamodb', status: 'complete', title: 'DynamoDB', summary: '1 durable record' }],
          redis: { status: 'ok', stockBySale: [], userReservationIds: [], reservations: [], expiryQueues: [] },
          sqs: {
            status: 'ok',
            queues: [
              {
                type: 'reservation',
                queueUrl: 'http://localstack:4566/000000000000/dev-reservation-events',
                visibleMessages: 0,
                inFlightMessages: 0
              }
            ]
          },
          dynamodb: {
            status: 'ok',
            tableName: 'flash-sale-reservations-local',
            shopperRecords: [
              {
                reservationId: 'res_1',
                saleId: 'sale_founder_001',
                userToken: 'usr_tok_123',
                status: 'RESERVED',
                updatedAt: '2026-05-05T10:01:00.000Z'
              }
            ]
          },
          manualWorker: {}
        })
      });

    vi.stubGlobal('fetch', fetchMock);

    renderApp('/');
    fillLandingForm({ name: 'Jim', email: 'jim@example.com' });
    fireEvent.click(screen.getByRole('button', { name: 'Enter the sale' }));

    expect(await screen.findByRole('heading', { name: 'Products' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Process worker now' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Refresh' })).toBeDefined();
    expect(screen.getByText('Last heartbeat: 2026-05-05T10:00:00.000Z')).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));

    expect(await screen.findByText('1 durable record')).toBeDefined();
    expect(screen.getByText('res_1')).toBeDefined();
  });

  it('prefers the manual worker last run time over a later refresh timestamp', async () => {
    const fetchMock = vi
      .fn()
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
        json: async () => ({ userToken: 'usr_tok_123', displayName: 'Jim' })
      })
      .mockResolvedValueOnce({
        json: async () => ({ items: [] })
      })
      .mockResolvedValueOnce({
        json: async () => ({
          generatedAt: '2026-05-05T10:00:00.000Z',
          workerMode: 'manual',
          shopper: { userToken: 'usr_tok_123', displayName: 'Jim' },
          app: {
            page: 'product-list',
            cartCount: 0,
            purchaseCount: 0,
            activeSaleCount: 1,
            userLabel: 'Jim',
            pendingSqsCount: 1
          },
          pipeline: [],
          redis: { status: 'ok', stockBySale: [], userReservationIds: [], reservations: [], expiryQueues: [] },
          sqs: { status: 'ok', queues: [] },
          dynamodb: { status: 'ok', tableName: 'flash-sale-reservations-local', shopperRecords: [] },
          manualWorker: {}
        })
      })
      .mockResolvedValueOnce({
        json: async () => ({
          generatedAt: '2026-05-05T10:02:00.000Z',
          workerMode: 'manual',
          shopper: { userToken: 'usr_tok_123', displayName: 'Jim' },
          app: {
            page: 'product-list',
            cartCount: 0,
            purchaseCount: 0,
            activeSaleCount: 1,
            userLabel: 'Jim',
            pendingSqsCount: 1
          },
          pipeline: [],
          redis: { status: 'ok', stockBySale: [], userReservationIds: [], reservations: [], expiryQueues: [] },
          sqs: { status: 'ok', queues: [] },
          dynamodb: { status: 'ok', tableName: 'flash-sale-reservations-local', shopperRecords: [] },
          manualWorker: {
            lastRunAt: '2026-05-05T10:01:00.000Z',
            lastResult: { reservation: 1, purchase: 0, expiry: 0 }
          }
        })
      });

    vi.stubGlobal('fetch', fetchMock);

    renderApp('/');
    fillLandingForm({ name: 'Jim', email: 'jim@example.com' });
    fireEvent.click(screen.getByRole('button', { name: 'Enter the sale' }));

    expect(await screen.findByRole('heading', { name: 'Products' })).toBeDefined();
    expect(screen.getByText('Last manual run: 2026-05-05T10:00:00.000Z')).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));

    expect(await screen.findByText('Last updated: 2026-05-05T10:02:00.000Z')).toBeDefined();
    expect(screen.getByText('Last manual run: 2026-05-05T10:01:00.000Z')).toBeDefined();
    expect(screen.queryByText('Last manual run: 2026-05-05T10:02:00.000Z')).toBeNull();
  });

  it('processes the worker from the dock and appends backend delta activity rows', async () => {
    const fetchMock = vi
      .fn()
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
        json: async () => ({ userToken: 'usr_tok_123', displayName: 'Jim' })
      })
      .mockResolvedValueOnce({
        json: async () => ({ items: [] })
      })
      .mockResolvedValueOnce({
        json: async () => ({
          generatedAt: '2026-05-05T10:00:00.000Z',
          workerMode: 'manual',
          shopper: { userToken: 'usr_tok_123', displayName: 'Jim' },
          app: {
            page: 'product-list',
            cartCount: 0,
            purchaseCount: 0,
            activeSaleCount: 1,
            userLabel: 'Jim',
            pendingSqsCount: 1
          },
          pipeline: [{ stage: 'sqs', status: 'waiting', title: 'SQS', summary: '1 queued message' }],
          redis: {
            status: 'ok',
            stockBySale: [{ saleId: 'sale_founder_001', stock: 10 }],
            userReservationIds: [],
            reservations: [],
            expiryQueues: []
          },
          sqs: {
            status: 'ok',
            queues: [
              {
                type: 'reservation',
                queueUrl: 'http://localstack:4566/000000000000/dev-reservation-events',
                visibleMessages: 1,
                inFlightMessages: 0
              }
            ]
          },
          dynamodb: { status: 'ok', tableName: 'flash-sale-reservations-local', shopperRecords: [] },
          manualWorker: {}
        })
      })
      .mockResolvedValueOnce({
        json: async () => ({ processed: { reservation: 1, purchase: 0, expiry: 0 }, processedAt: '2026-05-05T10:01:00.000Z' })
      })
      .mockResolvedValueOnce({
        json: async () => ({
          generatedAt: '2026-05-05T10:01:00.000Z',
          workerMode: 'manual',
          shopper: { userToken: 'usr_tok_123', displayName: 'Jim' },
          app: {
            page: 'product-list',
            cartCount: 0,
            purchaseCount: 0,
            activeSaleCount: 1,
            userLabel: 'Jim',
            pendingSqsCount: 0
          },
          pipeline: [{ stage: 'dynamodb', status: 'complete', title: 'DynamoDB', summary: '1 durable record' }],
          redis: {
            status: 'ok',
            stockBySale: [{ saleId: 'sale_founder_001', stock: 9 }],
            userReservationIds: ['res_1'],
            reservations: [
              {
                reservationId: 'res_1',
                saleId: 'sale_founder_001',
                userToken: 'usr_tok_123',
                status: 'RESERVED',
                expiresAt: '2026-05-05T10:05:00.000Z'
              }
            ],
            expiryQueues: [{ saleId: 'sale_founder_001', size: 1 }]
          },
          sqs: {
            status: 'ok',
            queues: [
              {
                type: 'reservation',
                queueUrl: 'http://localstack:4566/000000000000/dev-reservation-events',
                visibleMessages: 0,
                inFlightMessages: 0
              }
            ]
          },
          dynamodb: {
            status: 'ok',
            tableName: 'flash-sale-reservations-local',
            shopperRecords: [
              {
                reservationId: 'res_1',
                saleId: 'sale_founder_001',
                userToken: 'usr_tok_123',
                status: 'RESERVED',
                updatedAt: '2026-05-05T10:01:00.000Z'
              }
            ]
          },
          manualWorker: {
            lastRunAt: '2026-05-05T10:01:00.000Z',
            lastResult: { reservation: 1, purchase: 0, expiry: 0 }
          }
        })
      });

    vi.stubGlobal('fetch', fetchMock);

    renderApp('/');
    fillLandingForm({ name: 'Jim', email: 'jim@example.com' });
    fireEvent.click(screen.getByRole('button', { name: 'Enter the sale' }));

    expect(await screen.findByRole('heading', { name: 'Products' })).toBeDefined();
    expect(await screen.findByText('1 queued message')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Refresh' })).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Process worker now' }));

    expect(await screen.findByText('1 durable record')).toBeDefined();
    expect(screen.getByText('Last manual run: 2026-05-05T10:01:00.000Z')).toBeDefined();

    const activityQueries = within(screen.getByRole('table', { name: 'Activity' }));
    expect(activityQueries.getByText('manual worker triggered')).toBeDefined();
    expect(activityQueries.getByText('stock changed')).toBeDefined();
    expect(activityQueries.getByText('reservation appeared')).toBeDefined();
    expect(activityQueries.getByText('queue counts changed')).toBeDefined();
    expect(activityQueries.getByText('shopper record appeared')).toBeDefined();
    expect(activityQueries.getByText('processed queues')).toBeDefined();
  });

  it('renders warning states when a backend subsystem is unavailable', async () => {
    const fetchMock = vi
      .fn()
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
        json: async () => ({ userToken: 'usr_tok_123', displayName: 'Jim' })
      })
      .mockResolvedValueOnce({
        json: async () => ({ items: [] })
      })
      .mockResolvedValueOnce({
        json: async () => ({
          generatedAt: '2026-05-05T10:00:00.000Z',
          workerMode: 'manual',
          shopper: { userToken: 'usr_tok_123', displayName: 'Jim' },
          app: {
            page: 'product-list',
            cartCount: 0,
            purchaseCount: 0,
            activeSaleCount: 1,
            userLabel: 'Jim',
            pendingSqsCount: null
          },
          pipeline: [
            { stage: 'sqs', status: 'unavailable', title: 'SQS', summary: 'Queue data unavailable' },
            { stage: 'worker', status: 'warning', title: 'Worker', summary: 'SQS unavailable' }
          ],
          redis: { status: 'ok', stockBySale: [], userReservationIds: [], reservations: [], expiryQueues: [] },
          sqs: {
            status: 'unavailable',
            queues: [
              {
                type: 'reservation',
                queueUrl: 'http://localstack:4566/000000000000/dev-reservation-events',
                visibleMessages: null,
                inFlightMessages: null
              }
            ]
          },
          dynamodb: { status: 'ok', tableName: 'flash-sale-reservations-local', shopperRecords: [] },
          manualWorker: { lastError: 'SQS unavailable' }
        })
      });

    vi.stubGlobal('fetch', fetchMock);

    renderApp('/');
    fillLandingForm({ name: 'Jim', email: 'jim@example.com' });
    fireEvent.click(screen.getByRole('button', { name: 'Enter the sale' }));

    expect(await screen.findByRole('heading', { name: 'Products' })).toBeDefined();
    expect(screen.getByText('Queue data unavailable')).toBeDefined();
    expect(screen.getByText('SQS unavailable')).toBeDefined();
    expect(screen.getByText('Last worker result: SQS unavailable')).toBeDefined();
    const sqsTable = screen.getByRole('table', { name: 'SQS data' });
    expect(sqsTable).toBeDefined();
    expect(within(sqsTable).getAllByText('n/a')).toHaveLength(2);
  });

  it('refreshes the developer dock immediately after add-to-cart succeeds', async () => {
    const sales = [
      {
        saleId: 'sale_founder_001',
        itemName: 'Founder Tee',
        status: 'active' as const,
        startsAt: '2026-05-06T10:00:00Z',
        endsAt: '2026-05-06T12:00:00Z',
        reservationTtlSeconds: 300
      }
    ];

    let observabilityCalls = 0;

    const fetchMock = vi.fn((input: string | URL | Request, init?: RequestInit) => {
      const url = normalizeRequestPath(input);
      const method = init?.method ?? 'GET';

      if (url === '/sales' && method === 'GET') {
        return Promise.resolve(jsonResponse({ items: sales }));
      }

      if (url === '/sessions' && method === 'POST') {
        return Promise.resolve(jsonResponse({ userToken: 'usr_tok_123', displayName: 'Jim' }));
      }

      if (url === '/reservations' && method === 'GET') {
        return Promise.resolve(jsonResponse({ items: [] }));
      }

      if (url.startsWith('/debug/observability') && method === 'GET') {
        observabilityCalls += 1;

        return Promise.resolve(
          jsonResponse(
            observabilityCalls === 1
              ? defaultObservabilitySnapshot({ displayName: 'Jim', sales })
              : {
                  ...defaultObservabilitySnapshot({ displayName: 'Jim', sales }),
                  generatedAt: '2026-05-05T10:01:00.000Z',
                  app: {
                    page: 'product-page',
                    cartCount: 1,
                    purchaseCount: 0,
                    activeSaleCount: 1,
                    userLabel: 'Jim',
                    pendingSqsCount: 1
                  },
                  redis: {
                    status: 'ok',
                    stockBySale: [{ saleId: 'sale_founder_001', stock: 9 }],
                    userReservationIds: ['res_1'],
                    reservations: [
                      {
                        reservationId: 'res_1',
                        saleId: 'sale_founder_001',
                        userToken: 'usr_tok_123',
                        status: 'RESERVED',
                        expiresAt: '2099-05-05T10:05:00.000Z'
                      }
                    ],
                    expiryQueues: [{ saleId: 'sale_founder_001', size: 1 }]
                  },
                  sqs: {
                    status: 'ok',
                    queues: [
                      {
                        type: 'reservation',
                        queueUrl: 'http://localstack:4566/000000000000/dev-reservation-events',
                        visibleMessages: 1,
                        inFlightMessages: 0
                      }
                    ]
                  }
                }
          )
        );
      }

      if (url === '/sales/sale_founder_001/reservations' && method === 'POST') {
        return Promise.resolve(
          jsonResponse({
            status: 'RESERVED',
            reservationId: 'res_1',
            expiresAt: '2099-05-05T10:05:00.000Z',
            remainingStock: 9
          })
        );
      }

      throw new Error(`Unhandled fetch: ${method} ${url}`);
    });

    vi.stubGlobal('fetch', fetchMock);

    renderApp('/');
    fillLandingForm({ name: 'Jim', email: 'jim@example.com' });
    fireEvent.click(screen.getByRole('button', { name: 'Enter the sale' }));

    expect(await screen.findByRole('heading', { name: 'Products' })).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: 'View product' }));
    expect(await screen.findByRole('button', { name: 'Add to cart' })).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: 'Add to cart' }));
    const redisTable = await screen.findByRole('table', { name: 'Redis data' });
    expect(await within(redisTable).findByText('res_1')).toBeDefined();
  });

  it('refreshes the developer dock immediately after remove-from-cart succeeds', async () => {
    const sales = [
      {
        saleId: 'sale_founder_001',
        itemName: 'Founder Tee',
        status: 'active' as const,
        startsAt: '2026-05-06T10:00:00Z',
        endsAt: '2026-05-06T12:00:00Z',
        reservationTtlSeconds: 300
      }
    ];

    let didCancelReservation = false;

    const fetchMock = vi.fn((input: string | URL | Request, init?: RequestInit) => {
      const url = normalizeRequestPath(input);
      const method = init?.method ?? 'GET';

      if (url === '/sales' && method === 'GET') return Promise.resolve(jsonResponse({ items: sales }));
      if (url === '/sessions' && method === 'POST') {
        return Promise.resolve(jsonResponse({ userToken: 'usr_tok_123', displayName: 'Jim' }));
      }
      if (url === '/reservations' && method === 'GET') {
        return Promise.resolve(
          jsonResponse({
            items: [
              {
                reservationId: 'res_1',
                saleId: 'sale_founder_001',
                userToken: 'usr_tok_123',
                status: 'RESERVED',
                expiresAt: '2099-05-05T10:05:00.000Z'
              }
            ]
          })
        );
      }
      if (url.startsWith('/debug/observability') && method === 'GET') {
        return Promise.resolve(
          jsonResponse(
            !didCancelReservation
              ? {
                  ...defaultObservabilitySnapshot({ displayName: 'Jim', sales }),
                  app: {
                    page: 'checkout',
                    cartCount: 1,
                    purchaseCount: 0,
                    activeSaleCount: 1,
                    userLabel: 'Jim',
                    pendingSqsCount: 0
                  },
                  redis: {
                    status: 'ok',
                    stockBySale: [{ saleId: 'sale_founder_001', stock: 9 }],
                    userReservationIds: ['res_1'],
                    reservations: [
                      {
                        reservationId: 'res_1',
                        saleId: 'sale_founder_001',
                        userToken: 'usr_tok_123',
                        status: 'RESERVED',
                        expiresAt: '2099-05-05T10:05:00.000Z'
                      }
                    ],
                    expiryQueues: [{ saleId: 'sale_founder_001', size: 1 }]
                  }
                }
              : {
                  ...defaultObservabilitySnapshot({ displayName: 'Jim', sales }),
                  generatedAt: '2026-05-05T10:01:00.000Z',
                  app: {
                    page: 'checkout',
                    cartCount: 0,
                    purchaseCount: 0,
                    activeSaleCount: 1,
                    userLabel: 'Jim',
                    pendingSqsCount: 0
                  },
                  redis: {
                    status: 'ok',
                    stockBySale: [{ saleId: 'sale_founder_001', stock: 10 }],
                    userReservationIds: [],
                    reservations: [],
                    expiryQueues: [{ saleId: 'sale_founder_001', size: 0 }]
                  }
                }
          )
        );
      }
      if (url === '/reservations/res_1' && method === 'DELETE') {
        didCancelReservation = true;
        return Promise.resolve(jsonResponse({ status: 'CANCELLED' }));
      }

      throw new Error(`Unhandled fetch: ${method} ${url}`);
    });

    vi.stubGlobal('fetch', fetchMock);

    renderApp('/');
    fillLandingForm({ name: 'Jim', email: 'jim@example.com' });
    fireEvent.click(screen.getByRole('button', { name: 'Enter the sale' }));

    expect(await screen.findByRole('heading', { name: 'Products' })).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Go to checkout' }));
    expect(await screen.findByRole('heading', { name: 'Review your cart' })).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Remove from cart' }));

    const redisTable = await screen.findByRole('table', { name: 'Redis data' });
    expect(await within(redisTable).findByText('sale stock')).toBeDefined();
    await waitFor(() => {
      expect(within(screen.getByRole('table', { name: 'Redis data' })).queryByText('res_1')).toBeNull();
    });
  });

  it('refreshes the developer dock immediately after purchase succeeds', async () => {
    const sales = [
      {
        saleId: 'sale_founder_001',
        itemName: 'Founder Tee',
        status: 'active' as const,
        startsAt: '2026-05-06T10:00:00Z',
        endsAt: '2026-05-06T12:00:00Z',
        reservationTtlSeconds: 300
      }
    ];

    let didCheckoutReservation = false;

    const fetchMock = vi.fn((input: string | URL | Request, init?: RequestInit) => {
      const url = normalizeRequestPath(input);
      const method = init?.method ?? 'GET';

      if (url === '/sales' && method === 'GET') return Promise.resolve(jsonResponse({ items: sales }));
      if (url === '/sessions' && method === 'POST') {
        return Promise.resolve(jsonResponse({ userToken: 'usr_tok_123', displayName: 'Jim' }));
      }
      if (url === '/reservations' && method === 'GET') {
        return Promise.resolve(
          jsonResponse({
            items: [
              {
                reservationId: 'res_1',
                saleId: 'sale_founder_001',
                userToken: 'usr_tok_123',
                status: 'RESERVED',
                expiresAt: '2099-05-05T10:05:00.000Z'
              }
            ]
          })
        );
      }
      if (url.startsWith('/debug/observability') && method === 'GET') {
        return Promise.resolve(
          jsonResponse(
            !didCheckoutReservation
              ? {
                  ...defaultObservabilitySnapshot({ displayName: 'Jim', sales }),
                  app: {
                    page: 'checkout',
                    cartCount: 1,
                    purchaseCount: 0,
                    activeSaleCount: 1,
                    userLabel: 'Jim',
                    pendingSqsCount: 1
                  },
                  redis: {
                    status: 'ok',
                    stockBySale: [{ saleId: 'sale_founder_001', stock: 9 }],
                    userReservationIds: ['res_1'],
                    reservations: [
                      {
                        reservationId: 'res_1',
                        saleId: 'sale_founder_001',
                        userToken: 'usr_tok_123',
                        status: 'RESERVED',
                        expiresAt: '2099-05-05T10:05:00.000Z'
                      }
                    ],
                    expiryQueues: [{ saleId: 'sale_founder_001', size: 1 }]
                  }
                }
              : {
                  ...defaultObservabilitySnapshot({ displayName: 'Jim', sales }),
                  generatedAt: '2026-05-05T10:02:00.000Z',
                  app: {
                    page: 'confirmation',
                    cartCount: 0,
                    purchaseCount: 1,
                    activeSaleCount: 1,
                    userLabel: 'Jim',
                    pendingSqsCount: 1
                  },
                  redis: {
                    status: 'ok',
                    stockBySale: [{ saleId: 'sale_founder_001', stock: 9 }],
                    userReservationIds: [],
                    reservations: [],
                    expiryQueues: [{ saleId: 'sale_founder_001', size: 0 }]
                  },
                  dynamodb: {
                    status: 'ok',
                    tableName: 'flash-sale-reservations-local',
                    shopperRecords: [
                      {
                        reservationId: 'res_1',
                        saleId: 'sale_founder_001',
                        userToken: 'usr_tok_123',
                        status: 'PURCHASED',
                        purchasedAt: '2026-05-05T10:02:00.000Z',
                        updatedAt: '2026-05-05T10:02:00.000Z'
                      }
                    ]
                  }
                }
          )
        );
      }
      if (url === '/reservations/res_1/checkout' && method === 'POST') {
        didCheckoutReservation = true;
        return Promise.resolve(
          jsonResponse({
            status: 'PURCHASED',
            reservationId: 'res_1',
            purchasedAt: '2026-05-05T10:02:00.000Z'
          })
        );
      }

      throw new Error(`Unhandled fetch: ${method} ${url}`);
    });

    vi.stubGlobal('fetch', fetchMock);

    renderApp('/');
    fillLandingForm({ name: 'Jim', email: 'jim@example.com' });
    fireEvent.click(screen.getByRole('button', { name: 'Enter the sale' }));

    expect(await screen.findByRole('heading', { name: 'Products' })).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Go to checkout' }));
    expect(await screen.findByRole('heading', { name: 'Review your cart' })).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Pay now' }));
    expect(await screen.findByText('Pay for Founder Tee')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Confirm payment' }));
    const dynamoTable = screen.getByRole('table', { name: 'DynamoDB data' });
    expect(await within(dynamoTable).findByText('PURCHASED')).toBeDefined();
    expect(within(dynamoTable).getByText('res_1')).toBeDefined();
  });

  it('refreshes the developer dock immediately after checkout returns reservation expired', async () => {
    const sales = [
      {
        saleId: 'sale_founder_001',
        itemName: 'Founder Tee',
        status: 'active' as const,
        startsAt: '2026-05-06T10:00:00Z',
        endsAt: '2026-05-06T12:00:00Z',
        reservationTtlSeconds: 300
      }
    ];

    let didCheckoutReservation = false;

    const fetchMock = vi.fn((input: string | URL | Request, init?: RequestInit) => {
      const url = normalizeRequestPath(input);
      const method = init?.method ?? 'GET';

      if (url === '/sales' && method === 'GET') return Promise.resolve(jsonResponse({ items: sales }));
      if (url === '/sessions' && method === 'POST') {
        return Promise.resolve(jsonResponse({ userToken: 'usr_tok_123', displayName: 'Jim' }));
      }
      if (url === '/reservations' && method === 'GET') {
        return Promise.resolve(
          jsonResponse({
            items: didCheckoutReservation
              ? []
              : [
                  {
                    reservationId: 'res_1',
                    saleId: 'sale_founder_001',
                    userToken: 'usr_tok_123',
                    status: 'RESERVED',
                    expiresAt: '2099-05-05T10:05:00.000Z'
                  }
                ]
          })
        );
      }
      if (url.startsWith('/debug/observability') && method === 'GET') {
        return Promise.resolve(
          jsonResponse(
            !didCheckoutReservation
              ? {
                  ...defaultObservabilitySnapshot({ displayName: 'Jim', sales }),
                  app: {
                    page: 'checkout',
                    cartCount: 1,
                    purchaseCount: 0,
                    activeSaleCount: 1,
                    userLabel: 'Jim',
                    pendingSqsCount: 1
                  },
                  redis: {
                    status: 'ok',
                    stockBySale: [{ saleId: 'sale_founder_001', stock: 9 }],
                    userReservationIds: ['res_1'],
                    reservations: [
                      {
                        reservationId: 'res_1',
                        saleId: 'sale_founder_001',
                        userToken: 'usr_tok_123',
                        status: 'RESERVED',
                        expiresAt: '2099-05-05T10:05:00.000Z'
                      }
                    ],
                    expiryQueues: [{ saleId: 'sale_founder_001', size: 1 }]
                  }
                }
              : {
                  ...defaultObservabilitySnapshot({ displayName: 'Jim', sales }),
                  generatedAt: '2026-05-05T10:03:00.000Z',
                  app: {
                    page: 'checkout',
                    cartCount: 0,
                    purchaseCount: 0,
                    activeSaleCount: 1,
                    userLabel: 'Jim',
                    pendingSqsCount: 0
                  },
                  redis: {
                    status: 'ok',
                    stockBySale: [{ saleId: 'sale_founder_001', stock: 10 }],
                    userReservationIds: [],
                    reservations: [],
                    expiryQueues: [{ saleId: 'sale_founder_001', size: 0 }]
                  }
                }
          )
        );
      }
      if (url === '/reservations/res_1/checkout' && method === 'POST') {
        didCheckoutReservation = true;
        return Promise.resolve(jsonResponse({ status: 'RESERVATION_EXPIRED', reservationId: 'res_1' }));
      }

      throw new Error(`Unhandled fetch: ${method} ${url}`);
    });

    vi.stubGlobal('fetch', fetchMock);

    renderApp('/');
    fillLandingForm({ name: 'Jim', email: 'jim@example.com' });
    fireEvent.click(screen.getByRole('button', { name: 'Enter the sale' }));

    expect(await screen.findByRole('heading', { name: 'Products' })).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Go to checkout' }));
    expect(await screen.findByRole('heading', { name: 'Review your cart' })).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Pay now' }));
    expect(await screen.findByText('Pay for Founder Tee')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Confirm payment' }));
    const redisTable = screen.getByRole('table', { name: 'Redis data' });
    expect(await within(redisTable).findByText('sale stock')).toBeDefined();
    expect(within(redisTable).queryByText('res_1')).toBeNull();
  });

  it('records a frontend activity event when add-to-cart is rejected because the sale is not active', async () => {
    const sales = [
      {
        saleId: 'sale_founder_001',
        itemName: 'Founder Tee',
        status: 'active' as const,
        startsAt: '2026-05-06T10:30:00Z',
        endsAt: '2026-05-06T12:00:00Z',
        reservationTtlSeconds: 300
      }
    ];

    const fetchMock = vi.fn((input: string | URL | Request, init?: RequestInit) => {
      const url = normalizeRequestPath(input);
      const method = init?.method ?? 'GET';

      if (url === '/sales' && method === 'GET') return Promise.resolve(jsonResponse({ items: sales }));
      if (url === '/sessions' && method === 'POST') {
        return Promise.resolve(jsonResponse({ userToken: 'usr_tok_123', displayName: 'Jim' }));
      }
      if (url === '/reservations' && method === 'GET') return Promise.resolve(jsonResponse({ items: [] }));
      if (url.startsWith('/debug/observability') && method === 'GET') {
        return Promise.resolve(jsonResponse(defaultObservabilitySnapshot({ displayName: 'Jim', sales })));
      }
      if (url === '/sales/sale_founder_001/reservations' && method === 'POST') {
        return Promise.resolve(jsonResponse({ status: 'SALE_NOT_ACTIVE' }));
      }

      throw new Error(`Unhandled fetch: ${method} ${url}`);
    });

    vi.stubGlobal('fetch', fetchMock);

    renderApp('/');
    fillLandingForm({ name: 'Jim', email: 'jim@example.com' });
    fireEvent.click(screen.getByRole('button', { name: 'Enter the sale' }));

    expect(await screen.findByRole('heading', { name: 'Products' })).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'View product' }));
    expect(await screen.findByRole('button', { name: 'Add to cart' })).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: 'Add to cart' }));
    const activityQueries = within(await screen.findByRole('table', { name: 'Activity' }));
    expect(activityQueries.getByText('attempted add to cart')).toBeDefined();
    expect(activityQueries.getByText('Founder Tee could not be reserved because the sale is not active.')).toBeDefined();
  });

  it('renders the products page with the review-3 product grid and cart rail', async () => {
    const fetchMock = mockShopperEntryFetch({
      displayName: 'Jim',
      sales: [
        {
          saleId: 'sale_founder_001',
          itemName: 'Founder Tee',
          status: 'active',
          startsAt: '2026-05-06T10:00:00Z',
          endsAt: '2026-05-06T12:00:00Z',
          reservationTtlSeconds: 300
        },
        {
          saleId: 'sale_cap_001',
          itemName: 'KooPiBi Cap',
          status: 'active',
          startsAt: '2026-05-06T10:00:00Z',
          endsAt: '2026-05-06T12:00:00Z',
          reservationTtlSeconds: 300
        },
        {
          saleId: 'sale_hoodie_001',
          itemName: 'KooPiBi Hoodie',
          status: 'upcoming',
          startsAt: '2026-05-06T12:40:00Z',
          endsAt: '2026-05-06T13:00:00Z',
          reservationTtlSeconds: 300
        }
      ]
    }).mockResolvedValueOnce({
      json: async () => ({
        status: 'RESERVED',
        reservationId: 'res_cap',
        expiresAt: '2026-05-06T10:05:00Z',
        remainingStock: 9
      })
    });

    vi.stubGlobal('fetch', fetchMock);

    renderApp('/');
    fillLandingForm({ name: 'Jim', email: 'jim@example.com' });
    fireEvent.click(screen.getByRole('button', { name: 'Enter the sale' }));
    fireEvent.click((await screen.findAllByRole('button', { name: 'View product' }))[1]);
    fireEvent.click(screen.getByRole('button', { name: 'Add to cart' }));
    fireEvent.click(screen.getByRole('button', { name: 'Back to products' }));

    expect(await screen.findByRole('heading', { name: 'Products' })).toBeDefined();
    expect(screen.getByText('KooPiBi / Flash Sale / Products')).toBeDefined();
    expect(screen.getByText('Limited drops with short sale windows.')).toBeDefined();
    expect(screen.queryByText('Live catalog')).toBeNull();
    expect(screen.queryByText('Held items')).toBeNull();
    expect(screen.getAllByText('Cart').length).toBeGreaterThan(0);
    expect(screen.getByText('Total')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Go to checkout' })).toBeDefined();
  });

  it('uses the compact shell panel, smaller page heading, and metric-free list header from the reference design', async () => {
    const fetchMock = mockShopperEntryFetch({
      displayName: 'Jim',
      sales: [
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

    const landingFrame = screen
      .getByRole('heading', {
        level: 1,
        name: 'Limited drops. Short windows. Shop the sale before it is gone.'
      })
      .closest('section');
    expect(landingFrame?.style.borderRadius).toBe('22px');

    fillLandingForm({ name: 'Jim', email: 'jim@example.com' });
    fireEvent.click(screen.getByRole('button', { name: 'Enter the sale' }));

    fireEvent.click(await screen.findByRole('button', { name: 'View product' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Add to cart' }));
    expect(await screen.findByText('This item is held in your cart.')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Back to products' }));

    const shopperShell = (await screen.findByRole('heading', { name: 'Products' })).closest('section') as HTMLElement;
    const shopperQueries = within(shopperShell);

    expect(shopperQueries.queryByRole('heading', { name: 'Available drops' })).toBeNull();
    expect(shopperQueries.getAllByText('Limited Sneaker').length).toBeGreaterThan(0);

    const productListHeading = shopperQueries.getByRole('heading', { name: 'Products' });
    expect(productListHeading.style.fontSize).toBe('24px');

    expect(shopperQueries.queryByText('Session')).toBeNull();
    expect(shopperQueries.queryByText('Checkout')).toBeNull();
    expect(shopperQueries.getAllByText('Cart').length).toBeGreaterThan(0);
    expect(shopperQueries.getByText('Total')).toBeDefined();
    expect(shopperQueries.getByRole('button', { name: 'Go to checkout' })).toBeDefined();
  });

  it('renders product-list card titles and prices on the same emphasized row with sale time remaining', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(new Date('2026-05-06T10:00:00Z').valueOf());

    const fetchMock = mockShopperEntryFetch({
      displayName: 'Jim',
      sales: [
        {
          saleId: 'sale_founder_001',
          itemName: 'Founder Tee',
          status: 'active',
          startsAt: '2026-05-06T10:00:00Z',
          endsAt: '2026-05-06T12:00:00Z',
          reservationTtlSeconds: 300
        }
      ]
    });

    vi.stubGlobal('fetch', fetchMock);

    renderApp('/');
    fillLandingForm({ name: 'Jim', email: 'jim@example.com' });
    fireEvent.click(screen.getByRole('button', { name: 'Enter the sale' }));

    expect(await screen.findByRole('heading', { name: 'Products' })).toBeDefined();

    const productCard = screen.getByText('Founder Tee').closest('article') as HTMLElement;
    expect(productCard.style.minHeight).toBe('184px');
    const title = within(productCard).getByText('Founder Tee');
    const price = within(productCard).getByText('$48');
    const titlePriceRow = title.parentElement as HTMLElement;

    expect(titlePriceRow).toBe(price.parentElement);
    expect(titlePriceRow.style.display).toBe('flex');
    expect(titlePriceRow.style.justifyContent).toBe('space-between');
    expect(titlePriceRow.style.alignItems).toBe('baseline');
    expect(title.style.fontSize).toBe('20px');
    expect(price.style.fontSize).toBe('18px');
    expect(within(productCard).getByText('2h left')).toBeDefined();
    expect(within(productCard).queryByText('5 min hold')).toBeNull();
  });

  it('uses distinct shared gradients for real seeded backend products', async () => {
    const fetchMock = mockShopperEntryFetch({
      displayName: 'Jim',
      sales: [
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
          endsAt: '2026-05-06T11:00:00Z',
          reservationTtlSeconds: 300
        }
      ]
    });

    vi.stubGlobal('fetch', fetchMock);

    renderApp('/');
    fillLandingForm({ name: 'Jim', email: 'jim@example.com' });
    fireEvent.click(screen.getByRole('button', { name: 'Enter the sale' }));

    expect(await screen.findByRole('heading', { name: 'Products' })).toBeDefined();

    const sneakerCard = screen.getByText('Limited Sneaker').closest('article') as HTMLElement;
    const jacketCard = screen.getByText('Track Jacket').closest('article') as HTMLElement;
    const sneakerArt = sneakerCard.querySelector('[aria-hidden="true"]') as HTMLElement;
    const jacketArt = jacketCard.querySelector('[aria-hidden="true"]') as HTMLElement;

    expect(sneakerArt.style.background).not.toBe('linear-gradient(135deg, #cbd5e1 0%, #94a3b8 100%)');
    expect(jacketArt.style.background).not.toBe('linear-gradient(135deg, #cbd5e1 0%, #94a3b8 100%)');
    expect(sneakerArt.style.background).not.toBe(jacketArt.style.background);
  });

  it('orders active product cards by nearest sale end and highlights under-45-minute urgency in red', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(new Date('2026-05-06T10:00:00Z').valueOf());

    const fetchMock = mockShopperEntryFetch({
      displayName: 'Jim',
      sales: [
        {
          saleId: 'sale_founder_001',
          itemName: 'Founder Tee',
          status: 'active',
          startsAt: '2026-05-06T09:00:00Z',
          endsAt: '2026-05-06T12:00:00Z',
          reservationTtlSeconds: 300
        },
        {
          saleId: 'sale_jacket_002',
          itemName: 'Track Jacket',
          status: 'active',
          startsAt: '2026-05-06T09:30:00Z',
          endsAt: '2026-05-06T10:30:00Z',
          reservationTtlSeconds: 300
        },
        {
          saleId: 'sale_cap_003',
          itemName: 'Collector Cap',
          status: 'upcoming',
          startsAt: '2026-05-06T11:00:00Z',
          endsAt: '2026-05-06T12:30:00Z',
          reservationTtlSeconds: 300
        }
      ]
    });

    vi.stubGlobal('fetch', fetchMock);

    renderApp('/');
    fillLandingForm({ name: 'Jim', email: 'jim@example.com' });
    fireEvent.click(screen.getByRole('button', { name: 'Enter the sale' }));

    expect(await screen.findByRole('heading', { name: 'Products' })).toBeDefined();

    const cards = screen.getAllByRole('article');
    expect(within(cards[0]).getByText('Track Jacket')).toBeDefined();
    expect(within(cards[1]).getByText('Founder Tee')).toBeDefined();
    expect(within(cards[2]).getByText('Collector Cap')).toBeDefined();

    const urgentCard = cards[0] as HTMLElement;
    const urgentTitle = within(urgentCard).getByText('Track Jacket');
    const urgentFooter = within(urgentCard).getByText('30m left');
    const urgentButton = within(urgentCard).getByRole('button', { name: 'View product' }) as HTMLButtonElement;

    expect(urgentCard.style.border).toBe('2px solid rgb(239, 83, 80)');
    expect(urgentTitle.style.color).toBe('rgb(198, 40, 40)');
    expect(urgentFooter.style.color).toBe('rgb(183, 28, 28)');
    expect(urgentButton.style.background).toBe('rgb(211, 47, 47)');
  });

  it('shows the shared cart rail on products and product detail with total and checkout action', async () => {
    const fetchMock = mockShopperEntryFetch({
      displayName: 'Avery',
      sales: [
        {
          saleId: 'sale_cap_001',
          itemName: 'KooPiBi Cap',
          status: 'active',
          startsAt: '2026-05-06T10:00:00Z',
          endsAt: '2026-05-06T12:00:00Z',
          reservationTtlSeconds: 300
        }
      ]
    })
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
    fillLandingForm({ name: 'Avery', email: 'avery@example.com' });
    fireEvent.click(screen.getByRole('button', { name: 'Enter the sale' }));

    fireEvent.click(await screen.findByRole('button', { name: 'View product' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add to cart' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Back to products' }));

    const cartRail = (await screen.findByRole('button', { name: 'Go to checkout' })).closest('aside') as HTMLElement;
    expect(within(cartRail).getByText('Cart')).toBeDefined();
    expect(screen.getByText('Total')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Go to checkout' })).toBeDefined();
  });

  it('shows product detail with review hero layout and a persistent cart rail even when empty', async () => {
    const fetchMock = mockShopperEntryFetch({
      displayName: 'Avery',
      sales: [
        {
          saleId: 'sale_founder_001',
          itemName: 'Founder Tee',
          status: 'active',
          startsAt: '2026-05-06T10:00:00Z',
          endsAt: '2026-05-06T12:00:00Z',
          reservationTtlSeconds: 180
        }
      ]
    })
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
    fillLandingForm({ name: 'Avery', email: 'avery@example.com' });
    fireEvent.click(screen.getByRole('button', { name: 'Enter the sale' }));
    fireEvent.click(await screen.findByRole('button', { name: 'View product' }));

    const shopperShell = (await screen.findByText('KooPiBi / Flash Sale / Product')).closest('section') as HTMLElement;
    const shopperQueries = within(shopperShell);

    expect(shopperQueries.getAllByRole('heading', { name: 'Founder Tee', level: 1 })).toHaveLength(2);
    expect(shopperQueries.getByText('KooPiBi / Flash Sale / Product')).toBeDefined();
    expect(shopperQueries.queryByText('Session')).toBeNull();
    expect(shopperQueries.getByText('Heavyweight tee from the founder collection with limited stock for this drop.')).toBeDefined();
    expect(shopperQueries.getByText('$48')).toBeDefined();

    const heroCard = shopperQueries.getByText('Hold length').closest('article') as HTMLElement;
    const detailLayout = heroCard.parentElement as HTMLElement;
    expect(detailLayout.style.gridTemplateColumns).toBe('minmax(0, 1fr) 372px');

    const heroArt = heroCard.querySelector('[aria-hidden="true"]') as HTMLElement;
    expect(heroArt.style.background).toBe('linear-gradient(135deg, #8ec5fc 0%, #e0c3fc 100%)');

    expect(shopperQueries.getByText('Hold length')).toBeDefined();
    expect(shopperQueries.getByText('3 minutes')).toBeDefined();
    expect(shopperQueries.getByText('Status')).toBeDefined();
    expect(shopperQueries.getByText('Checkout')).toBeDefined();

    expect(shopperQueries.getByRole('heading', { name: 'Cart', level: 2 })).toBeDefined();
    expect(shopperQueries.getByText('Your cart is empty.')).toBeDefined();
    expect(shopperQueries.getByText('Hold an item from the grid to see its timer and total here.')).toBeDefined();
    const checkoutButton = shopperQueries.getByRole('button', { name: 'Go to checkout' }) as HTMLButtonElement;
    expect(checkoutButton.disabled).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: 'Add to cart' }));

    expect(await screen.findByText('This item is held in your cart.')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Remove from cart' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Back to products' })).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Add to cart' })).toBeNull();
    expect((screen.getByRole('button', { name: 'Go to checkout' }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('hides add to cart on product detail after the item is already held', async () => {
    const fetchMock = mockShopperEntryFetch({
      displayName: 'Avery',
      sales: [
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
    fillLandingForm({ name: 'Avery', email: 'avery@example.com' });
    fireEvent.click(screen.getByRole('button', { name: 'Enter the sale' }));
    fireEvent.click(await screen.findByRole('button', { name: 'View product' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add to cart' }));

    expect(await screen.findByText('This item is held in your cart.')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Remove from cart' })).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Add to cart' })).toBeNull();
  });

  it('disables add to cart on product detail when /sales reports the item is sold out', async () => {
    const fetchMock = mockShopperEntryFetch({
      displayName: 'Avery',
      sales: [
        {
          saleId: 'sale_jacket_002',
          itemName: 'Track Jacket',
          status: 'active',
          startsAt: '2026-05-06T10:00:00Z',
          endsAt: '2026-05-06T12:00:00Z',
          reservationTtlSeconds: 300,
          remainingStock: 0
        }
      ]
    });

    vi.stubGlobal('fetch', fetchMock);

    renderApp('/');
    fillLandingForm({ name: 'Avery', email: 'avery@example.com' });
    fireEvent.click(screen.getByRole('button', { name: 'Enter the sale' }));
    fireEvent.click(await screen.findByRole('button', { name: 'View product' }));

    expect(await screen.findByText('All flash-sale slots for this item have been claimed.')).toBeDefined();
    const soldOutButton = screen.getByRole('button', { name: 'Sold out' }) as HTMLButtonElement;
    expect(soldOutButton.disabled).toBe(true);
  });

  it('uses product detail as the cleanup surface for an expired held item', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(new Date('2026-05-06T10:04:00Z').valueOf());

    const fetchMock = mockShopperEntryFetch({
      displayName: 'Avery',
      sales: [
        {
          saleId: 'sale_jacket_002',
          itemName: 'Track Jacket',
          status: 'active',
          startsAt: '2026-05-06T10:00:00Z',
          endsAt: '2026-05-06T12:00:00Z',
          reservationTtlSeconds: 300,
          remainingStock: 4
        }
      ]
    }).mockResolvedValueOnce({
      json: async () => ({
        status: 'RESERVED',
        reservationId: 'res_jacket',
        expiresAt: '2026-05-06T10:03:00Z',
        remainingStock: 4
      })
    });

    vi.stubGlobal('fetch', fetchMock);

    renderApp('/');
    fillLandingForm({ name: 'Avery', email: 'avery@example.com' });
    fireEvent.click(screen.getByRole('button', { name: 'Enter the sale' }));
    fireEvent.click(await screen.findByRole('button', { name: 'View product' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add to cart' }));

    expect(await screen.findByText('This hold expired and was returned to stock.')).toBeDefined();
    expect(screen.getByText('Remove it from your cart before trying again.')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Remove from cart' })).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Add to cart' })).toBeNull();
  });

  it('keeps rendering the expired hold state when a held item expires on product detail', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-06T10:00:00Z'));

    const fetchMock = mockShopperEntryFetch({
      displayName: 'Avery',
      sales: [
        {
          saleId: 'sale_jacket_002',
          itemName: 'Track Jacket',
          status: 'active',
          startsAt: '2026-05-06T10:00:00Z',
          endsAt: '2026-05-06T12:00:00Z',
          reservationTtlSeconds: 300,
          remainingStock: 4
        }
      ]
    }).mockResolvedValueOnce({
      json: async () => ({
        status: 'RESERVED',
        reservationId: 'res_jacket',
        expiresAt: '2026-05-06T10:00:02Z',
        remainingStock: 4
      })
    });

    vi.stubGlobal('fetch', fetchMock);

    renderApp('/');
    await flushApp();

    fillLandingForm({ name: 'Avery', email: 'avery@example.com' });
    fireEvent.click(screen.getByRole('button', { name: 'Enter the sale' }));
    await flushApp();

    fireEvent.click(screen.getByRole('button', { name: 'View product' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add to cart' }));
    await flushApp();

    expect(screen.getByText('This item is held in your cart.')).toBeDefined();
    expect(window.location.pathname).toBe('/products/sale_jacket_002');

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2500);
    });

    expect(screen.getByText('KooPiBi / Flash Sale / Product')).toBeDefined();
    expect(screen.getAllByText('Track Jacket').length).toBeGreaterThan(0);
    expect(screen.getByText('This hold expired and was returned to stock.')).toBeDefined();
    expect(screen.getByText('Remove it from your cart before trying again.')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Remove from cart' })).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Add to cart' })).toBeNull();
    expect(window.location.pathname).toBe('/products/sale_jacket_002');
  });

  it('restores add to cart on product detail after removing an expired held item when stock remains', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(new Date('2026-05-06T10:04:00Z').valueOf());

    const fetchMock = mockShopperEntryFetch({
      displayName: 'Avery',
      sales: [
        {
          saleId: 'sale_jacket_002',
          itemName: 'Track Jacket',
          status: 'active',
          startsAt: '2026-05-06T10:00:00Z',
          endsAt: '2026-05-06T12:00:00Z',
          reservationTtlSeconds: 300,
          remainingStock: 4
        }
      ]
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
        json: async () => ({ status: 'CANCELLED' })
      });

    vi.stubGlobal('fetch', fetchMock);

    renderApp('/');
    fillLandingForm({ name: 'Avery', email: 'avery@example.com' });
    fireEvent.click(screen.getByRole('button', { name: 'Enter the sale' }));
    fireEvent.click(await screen.findByRole('button', { name: 'View product' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add to cart' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Remove from cart' }));

    const addToCartButton = (await screen.findByRole('button', { name: 'Add to cart' })) as HTMLButtonElement;
    expect(addToCartButton.disabled).toBe(false);
  });

  it('keeps an expired hold visible in the products cart rail when it is the only cart item', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(new Date('2026-05-06T10:04:00Z').valueOf());

    const fetchMock = mockShopperEntryFetch({
      displayName: 'Avery',
      sales: [
        {
          saleId: 'sale_jacket_002',
          itemName: 'Track Jacket',
          status: 'active',
          startsAt: '2026-05-06T10:00:00Z',
          endsAt: '2026-05-06T12:00:00Z',
          reservationTtlSeconds: 300
        }
      ]
    }).mockResolvedValueOnce({
      json: async () => ({
        status: 'RESERVED',
        reservationId: 'res_jacket',
        expiresAt: '2026-05-06T10:03:00Z',
        remainingStock: 4
      })
    });

    vi.stubGlobal('fetch', fetchMock);

    renderApp('/');
    fillLandingForm({ name: 'Avery', email: 'avery@example.com' });
    fireEvent.click(screen.getByRole('button', { name: 'Enter the sale' }));
    fireEvent.click(await screen.findByRole('button', { name: 'View product' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add to cart' }));
    fireEvent.click(screen.getByRole('button', { name: 'Back to products' }));

    expect(await screen.findByText('Products')).toBeDefined();
    expect(screen.queryByText('Your cart is empty.')).toBeNull();
    expect(screen.getByText('Expired')).toBeDefined();
    expect(screen.getAllByText('Track Jacket').length).toBeGreaterThan(1);
  });

  it('uses non-zero seeded catalog prices and responsive shared rail layouts', async () => {
    const fetchMock = mockShopperEntryFetch({
      displayName: 'Avery',
      sales: [
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
    fillLandingForm({ name: 'Avery', email: 'avery@example.com' });
    fireEvent.click(screen.getByRole('button', { name: 'Enter the sale' }));

    expect(await screen.findByText('Limited Sneaker')).toBeDefined();
    expect(screen.getByText('Track Jacket')).toBeDefined();
    expect(screen.getByText('$88')).toBeDefined();

    fireEvent.click(screen.getAllByRole('button', { name: 'View product' })[0]);
    fireEvent.click(await screen.findByRole('button', { name: 'Add to cart' }));

    expect(await screen.findByText('Total')).toBeDefined();
    expect(screen.queryByText('Price unavailable')).toBeNull();

    const productDetailLayout = screen.getByRole('button', { name: 'Go to checkout' }).closest('section') as HTMLElement;
    expect(productDetailLayout.style.gridTemplateColumns).toBe('minmax(0, 1fr) 372px');

    fireEvent.click(screen.getByRole('button', { name: 'Back to products' }));

    const productListLayout = (await screen.findByRole('button', { name: 'Go to checkout' })).closest('section') as HTMLElement;
    expect(productListLayout.style.gridTemplateColumns).toBe('minmax(0, 1fr) 372px');
  });

  it('keeps the same product-detail hero layout across held and purchased states', async () => {
    const fetchMock = mockShopperEntryFetch({
      displayName: 'Avery',
      sales: [
        {
          saleId: 'sale_duffel_001',
          itemName: 'Weekend Duffel',
          status: 'active',
          startsAt: '2026-05-06T10:00:00Z',
          endsAt: '2026-05-06T12:00:00Z',
          reservationTtlSeconds: 300
        }
      ],
      responses: [
        {
          status: 'RESERVED',
          reservationId: 'res_duffel',
          expiresAt: '2026-05-06T10:05:00Z',
          remainingStock: 6
        },
        {
          status: 'PURCHASED',
          reservationId: 'res_duffel',
          purchasedAt: '2026-05-06T10:02:00Z'
        }
      ]
    });

    vi.stubGlobal('fetch', fetchMock);

    renderApp('/');
    fillLandingForm({ name: 'Avery', email: 'avery@example.com' });
    fireEvent.click(screen.getByRole('button', { name: 'Enter the sale' }));
    fireEvent.click(await screen.findByRole('button', { name: 'View product' }));

    const initialHeroCard = screen.getByText('Hold length').closest('article') as HTMLElement;
    const initialLayout = initialHeroCard.parentElement as HTMLElement;
    expect(initialLayout.style.gridTemplateColumns).toBe('minmax(0, 1fr) 372px');

    fireEvent.click(screen.getByRole('button', { name: 'Add to cart' }));

    expect(await screen.findByText('This item is held in your cart.')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Remove from cart' })).toBeDefined();
    expect(((screen.getByText('Hold length').closest('article') as HTMLElement).parentElement as HTMLElement).style.gridTemplateColumns).toBe(
      'minmax(0, 1fr) 372px'
    );

    fireEvent.click(screen.getByRole('button', { name: 'Go to checkout' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Pay now' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm payment' }));

    expect(await screen.findByText('Payment confirmed.')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    fireEvent.click(screen.getByRole('button', { name: '← Keep shopping' }));

    const purchasedCard = (await screen.findAllByText('✓ Already purchased'))[0].closest('article') as HTMLElement;
    fireEvent.click(within(purchasedCard).getByRole('button', { name: 'View product' }));

    expect(await screen.findByText('Your purchase is complete.')).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Add to cart' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Back to products' })).toBeDefined();
    expect(((screen.getByText('Hold length').closest('article') as HTMLElement).parentElement as HTMLElement).style.gridTemplateColumns).toBe(
      'minmax(0, 1fr) 372px'
    );
  });

  it('keeps a newly introduced seeded storefront item priced across list, cart, checkout, and payment surfaces', async () => {
    const fetchMock = mockShopperEntryFetch({
      displayName: 'Avery',
      sales: [
        {
          saleId: 'sale_duffel_001',
          itemName: 'Weekend Duffel',
          status: 'active',
          startsAt: '2026-05-06T10:00:00Z',
          endsAt: '2026-05-06T12:00:00Z',
          reservationTtlSeconds: 300
        }
      ],
      responses: [
        {
          status: 'RESERVED',
          reservationId: 'res_duffel',
          expiresAt: '2026-05-06T10:05:00Z',
          remainingStock: 6
        },
        {
          status: 'PURCHASED',
          reservationId: 'res_duffel',
          purchasedAt: '2026-05-06T10:02:00Z'
        }
      ]
    });

    vi.stubGlobal('fetch', fetchMock);

    renderApp('/');
    fillLandingForm({ name: 'Avery', email: 'avery@example.com' });
    fireEvent.click(screen.getByRole('button', { name: 'Enter the sale' }));

    expect(await screen.findByText('Weekend Duffel')).toBeDefined();
    expect(screen.getByText('$96')).toBeDefined();
    expect(screen.queryByText('Price unavailable')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'View product' }));

    expect((await screen.findAllByRole('heading', { name: 'Weekend Duffel', level: 1 })).length).toBeGreaterThan(0);
    expect(screen.getByText('$96')).toBeDefined();
    expect(screen.queryByText('Price unavailable')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Add to cart' }));

    expect(await screen.findByText('This item is held in your cart.')).toBeDefined();
    expect(screen.getAllByText('$96').length).toBeGreaterThan(0);
    expect(screen.queryByText('Price unavailable')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Go to checkout' }));

    expect(await screen.findByRole('heading', { name: 'Review your cart' })).toBeDefined();
    expect(screen.getAllByText('$96').length).toBeGreaterThan(0);
    expect(screen.queryByText('Price unavailable')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Pay now' }));

    expect(await screen.findByText('Pay for Weekend Duffel')).toBeDefined();
    expect(screen.getAllByText('$96').length).toBeGreaterThan(0);
    expect(screen.queryByText('Price unavailable')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Confirm payment' }));

    expect(await screen.findByText('Payment confirmed.')).toBeDefined();
    expect(screen.getAllByText('$96').length).toBeGreaterThan(0);
    expect(screen.queryByText('Price unavailable')).toBeNull();
  });

  it('does not fall back to $0 for a live catalog item that is not in the seeded landing preview', async () => {
    const fetchMock = mockShopperEntryFetch({
      displayName: 'Avery',
      sales: [
        {
          saleId: 'sale_camera_001',
          itemName: 'Collector Camera',
          status: 'active',
          startsAt: '2026-05-06T10:00:00Z',
          endsAt: '2026-05-06T12:00:00Z',
          reservationTtlSeconds: 300,
          price: 135
        }
      ],
      responses: [
        {
          status: 'RESERVED',
          reservationId: 'res_camera',
          expiresAt: '2026-05-06T10:05:00Z',
          remainingStock: 3
        },
        {
          status: 'PURCHASED',
          reservationId: 'res_camera',
          purchasedAt: '2026-05-06T10:02:00Z'
        }
      ]
    });

    vi.stubGlobal('fetch', fetchMock);

    renderApp('/');
    fillLandingForm({ name: 'Avery', email: 'avery@example.com' });
    fireEvent.click(screen.getByRole('button', { name: 'Enter the sale' }));

    expect(await screen.findByText('Collector Camera')).toBeDefined();
    expect(screen.getByText('$135')).toBeDefined();
    expect(screen.queryByText('Price unavailable')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'View product' }));
    expect((await screen.findAllByRole('heading', { name: 'Collector Camera', level: 1 })).length).toBeGreaterThan(0);
    expect(screen.getByText('$135')).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: 'Add to cart' }));
    expect(await screen.findByText('This item is held in your cart.')).toBeDefined();
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
    const fetchMock = mockShopperEntryFetch({
      displayName: 'Avery',
      sales: [
        {
          saleId: 'sale_cap_001',
          itemName: 'KooPiBi Cap',
          status: 'active',
          startsAt: '2026-05-06T10:00:00Z',
          endsAt: '2026-05-06T12:00:00Z',
          reservationTtlSeconds: 300,
          price: 42
        }
      ],
      responses: [
        {
          status: 'RESERVED',
          reservationId: 'res_cap',
          expiresAt: '2026-05-06T10:05:00Z',
          remainingStock: 9
        },
        {
          status: 'PURCHASED',
          reservationId: 'res_cap',
          purchasedAt: '2026-05-06T10:02:00Z'
        }
      ]
    });

    vi.stubGlobal('fetch', fetchMock);

    renderAppWithTestNavigator('/');
    fillLandingForm({ name: 'Avery', email: 'avery@example.com' });
    fireEvent.click(screen.getByRole('button', { name: 'Enter the sale' }));
    fireEvent.click(await screen.findByRole('button', { name: 'View product' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add to cart' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Go to checkout' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Pay now' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Confirm payment' }));

    expect(await screen.findByText('Payment confirmed.')).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: 'Test navigate to confirmation' }));

    expect(await screen.findByRole('heading', { name: 'Order confirmed' })).toBeDefined();
    expect(screen.getByText('KooPiBi Cap')).toBeDefined();
    expect(screen.getByText('$42')).toBeDefined();
    expect(screen.getByText('res_cap')).toBeDefined();
    expect(screen.getByRole('button', { name: '← Back to products' })).toBeDefined();
  });

  it('renders the products page with prices, equal-size cards, and no top cart bar', async () => {
    const fetchMock = mockShopperEntryFetch({
      displayName: 'Jim',
      sales: [
        {
          saleId: 'sale_cap_001',
          itemName: 'KooPiBi Cap',
          status: 'active',
          startsAt: '2026-05-06T10:00:00Z',
          endsAt: '2026-05-06T12:00:00Z',
          reservationTtlSeconds: 300
        },
        {
          saleId: 'sale_hoodie_001',
          itemName: 'KooPiBi Hoodie',
          status: 'upcoming',
          startsAt: '2026-05-06T12:40:00Z',
          endsAt: '2026-05-06T13:00:00Z',
          reservationTtlSeconds: 300
        }
      ]
    });

    vi.stubGlobal('fetch', fetchMock);

    renderApp('/');
    fillLandingForm({ name: 'Jim', email: 'jim@example.com' });
    fireEvent.click(screen.getByRole('button', { name: 'Enter the sale' }));

    expect(await screen.findByRole('heading', { name: 'Products' })).toBeDefined();
    expect(screen.getByText('$42')).toBeDefined();
    expect(screen.getByText('$64')).toBeDefined();
    expect(screen.queryByText(/item held/i)).toBeNull();

    const activeCard = screen.getByText('KooPiBi Cap').closest('article') as HTMLElement;
    const upcomingCard = screen.getByText('KooPiBi Hoodie').closest('article') as HTMLElement;

    expect(activeCard.style.minHeight).toBe('184px');
    expect(upcomingCard.style.minHeight).toBe('184px');
    expect(upcomingCard.style.background).toBe('linear-gradient(180deg,#ffffff 0%,#f8faff 100%)');
  });

  it('opens a payment modal for one item and then shows an item-level payment confirmation modal', async () => {
    const fetchMock = mockShopperEntryFetch({
      displayName: 'Avery',
      sales: [
        {
          saleId: 'sale_cap_001',
          itemName: 'KooPiBi Cap',
          status: 'active',
          startsAt: '2026-05-06T10:00:00Z',
          endsAt: '2026-05-06T12:00:00Z',
          reservationTtlSeconds: 300
        }
      ],
      responses: [
        {
          status: 'RESERVED',
          reservationId: 'res_cap',
          expiresAt: '2026-05-06T10:05:00Z',
          remainingStock: 9
        },
        {
          status: 'PURCHASED',
          reservationId: 'res_cap',
          purchasedAt: '2026-05-06T10:02:00Z'
        }
      ]
    });

    vi.stubGlobal('fetch', fetchMock);

    renderApp('/');

    fillLandingForm({ name: 'Avery', email: 'avery@example.com' });
    fireEvent.click(screen.getByRole('button', { name: 'Enter the sale' }));
    fireEvent.click(await screen.findByRole('button', { name: 'View product' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add to cart' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Go to checkout' }));

    fireEvent.click(await screen.findByRole('button', { name: 'Pay now' }));

    expect(await screen.findByText('Pay for KooPiBi Cap')).toBeDefined();
    expect(screen.getByText('**** **** **** 4242')).toBeDefined();
    expect(screen.getByText('****')).toBeDefined();
    expect(screen.getByText('Name')).toBeDefined();
    const paymentDialog = screen.getByRole('dialog', { name: 'Pay for KooPiBi Cap' });
    expect(within(paymentDialog).getByText('Avery')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Confirm payment' })).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: 'Confirm payment' }));

    expect(await screen.findByText('Payment confirmed.')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Close' })).toBeDefined();
  });

  it('returns to checkout after closing the payment confirmation modal instead of routing to a full-page confirmation', async () => {
    const fetchMock = mockShopperEntryFetch({
      displayName: 'Jim',
      sales: [
        {
          saleId: 'sale_cap_001',
          itemName: 'KooPiBi Cap',
          status: 'active',
          startsAt: '2026-05-06T10:00:00Z',
          endsAt: '2026-05-06T12:00:00Z',
          reservationTtlSeconds: 300
        }
      ],
      responses: [
        {
          status: 'RESERVED',
          reservationId: 'res_cap',
          expiresAt: '2026-05-06T10:05:00Z',
          remainingStock: 9
        },
        {
          status: 'PURCHASED',
          reservationId: 'res_cap',
          purchasedAt: '2026-05-06T10:02:00Z'
        }
      ]
    });

    vi.stubGlobal('fetch', fetchMock);

    renderApp('/');
    fillLandingForm({ name: 'Jim', email: 'jim@example.com' });
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
      itemName: 'KooPiBi Cap',
      status: 'active' as const,
      startsAt: '2026-05-06T11:15:00Z',
      endsAt: '2026-05-06T13:45:00Z',
      reservationTtlSeconds: 300
    };

    const fetchMock = mockShopperEntryFetch({
      displayName: 'Jim',
      sales: [mockedSale],
      responses: [
        {
          status: 'RESERVED',
          reservationId: 'res_cap',
          expiresAt: '2026-05-06T10:05:00Z',
          remainingStock: 9
        }
      ]
    });

    vi.stubGlobal('fetch', fetchMock);

    renderApp('/');
    fillLandingForm({ name: 'Jim', email: 'jim@example.com' });
    fireEvent.click(screen.getByRole('button', { name: 'Enter the sale' }));
    fireEvent.click(await screen.findByRole('button', { name: 'View product' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add to cart' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Go to checkout' }));

    const checkoutRow = screen.getByText('KooPiBi Cap').closest('article') as HTMLElement;
    const expectedWindow = formatWindow(mockedSale.startsAt, mockedSale.endsAt);
    const saleWindow = await within(checkoutRow).findByText(expectedWindow);
    const bottomRow = saleWindow.parentElement as HTMLElement;
    const actions = within(bottomRow).getAllByRole('button');

    expect(within(bottomRow).getByText(expectedWindow)).toBeDefined();
    expect(actions.map((button) => button.textContent)).toEqual(['Remove from cart', 'Pay now']);
  });

  it('recovers the active hold after ALREADY_RESERVED when local cart state is stale', async () => {
    const fetchMock = mockShopperEntryFetch({
      displayName: 'Jim',
      sales: [
        {
          saleId: 'sale_sneaker_001',
          itemName: 'Limited Sneaker',
          status: 'active',
          startsAt: '2026-05-06T10:00:00Z',
          endsAt: '2026-05-06T12:00:00Z',
          reservationTtlSeconds: 300
        }
      ],
      responses: [
        { status: 'ALREADY_RESERVED' },
        {
          items: [
            {
              reservationId: 'res_existing',
              saleId: 'sale_sneaker_001',
              userToken: 'usr_tok_123',
              status: 'RESERVED',
              expiresAt: '2026-05-06T10:05:00Z'
            }
          ]
        }
      ]
    });

    vi.stubGlobal('fetch', fetchMock);

    renderApp('/');

    fillLandingForm({ name: 'Jim', email: 'jim@example.com' });
    fireEvent.click(screen.getByRole('button', { name: 'Enter the sale' }));
    fireEvent.click(await screen.findByRole('button', { name: 'View product' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add to cart' }));

    expect(await screen.findByText('This item is held in your cart.')).toBeDefined();
    expect(screen.getByText('You already have an active hold for this product.')).toBeDefined();
  });

  it('keeps an expired hold visible in checkout after the backend refreshes active reservations', async () => {
    const fetchMock = mockShopperEntryFetch({
      displayName: 'Jim',
      sales: [
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
      ],
      responses: [
        {
          status: 'RESERVED',
          reservationId: 'res_123',
          expiresAt: '2026-05-06T10:05:00Z',
          remainingStock: 9
        },
        {
          status: 'RESERVED',
          reservationId: 'res_jacket',
          expiresAt: '2026-05-06T10:03:00Z',
          remainingStock: 4
        },
        { status: 'RESERVATION_EXPIRED', reservationId: 'res_jacket' },
        {
          items: [
            {
              reservationId: 'res_123',
              saleId: 'sale_sneaker_001',
              userToken: 'usr_tok_123',
              status: 'RESERVED',
              expiresAt: '2026-05-06T10:05:00Z'
            }
          ]
        }
      ]
    });

    vi.stubGlobal('fetch', fetchMock);

    renderApp('/');

    fillLandingForm({ name: 'Jim', email: 'jim@example.com' });
    fireEvent.click(screen.getByRole('button', { name: 'Enter the sale' }));

    fireEvent.click((await screen.findAllByRole('button', { name: 'View product' }))[0]);
    fireEvent.click(screen.getByRole('button', { name: 'Add to cart' }));
    expect(await screen.findByText('This item is held in your cart.')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Back to products' }));

    fireEvent.click((await screen.findAllByRole('button', { name: 'View product' }))[1]);
    fireEvent.click(screen.getByRole('button', { name: 'Add to cart' }));
    expect(await screen.findByText('This item is held in your cart.')).toBeDefined();
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
    const expiredArticle = (await screen.findByText('Track Jacket')).closest('article') as HTMLElement;
    expect(within(expiredArticle).getAllByText('Expired')).toHaveLength(2);
    expect(within(expiredArticle).queryByRole('button', { name: 'Pay now' })).toBeNull();
    expect(within(expiredArticle).getByRole('button', { name: 'Remove from cart' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Pay now' })).toBeDefined();
  });

  it('keeps rendering the expired checkout state when a held item expires while staying on checkout', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-06T10:00:00Z'));

    const fetchMock = mockShopperEntryFetch({
      displayName: 'Jim',
      sales: [
        {
          saleId: 'sale_jacket_002',
          itemName: 'Track Jacket',
          status: 'active',
          startsAt: '2026-05-06T10:00:00Z',
          endsAt: '2026-05-06T12:00:00Z',
          reservationTtlSeconds: 300
        }
      ],
      responses: [
        {
          status: 'RESERVED',
          reservationId: 'res_jacket',
          expiresAt: '2026-05-06T10:00:02Z',
          remainingStock: 4
        }
      ]
    });

    vi.stubGlobal('fetch', fetchMock);

    renderApp('/');
    await flushApp();

    fillLandingForm({ name: 'Jim', email: 'jim@example.com' });
    fireEvent.click(screen.getByRole('button', { name: 'Enter the sale' }));
    await flushApp();

    fireEvent.click(screen.getByRole('button', { name: 'View product' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add to cart' }));
    await flushApp();
    fireEvent.click(screen.getByRole('button', { name: 'Go to checkout' }));

    expect(screen.getByRole('heading', { name: 'Review your cart' })).toBeDefined();
    expect(screen.getByText('Track Jacket')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Pay now' })).toBeDefined();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2500);
    });

    expect(screen.getByRole('heading', { name: 'Review your cart' })).toBeDefined();
    const expiredArticle = screen.getByText('Track Jacket').closest('article') as HTMLElement;
    expect(expiredArticle).toBeDefined();
    expect(within(expiredArticle).getAllByText('Expired')).toHaveLength(2);
    expect(
      within(expiredArticle).getByText('This hold expired and was returned to stock. Remove it manually when you are done.')
    ).toBeDefined();
    expect(within(expiredArticle).getByRole('button', { name: 'Remove from cart' })).toBeDefined();
    expect(within(expiredArticle).queryByRole('button', { name: 'Pay now' })).toBeNull();
    expect(window.location.pathname).toBe('/checkout');
  });

  it('refreshes product detail availability after a sold-out reservation response', async () => {
    const initialSales = [
      {
        saleId: 'sale_jacket_002',
        itemName: 'Track Jacket',
        status: 'active' as const,
        startsAt: '2026-05-06T10:00:00Z',
        endsAt: '2026-05-06T12:00:00Z',
        reservationTtlSeconds: 300,
        remainingStock: 1
      }
    ];
    const refreshedSales = [{ ...initialSales[0], remainingStock: 0 }];
    const salesQueue = [initialSales, refreshedSales];

    const fetchMock = vi.fn((input: string | URL | Request, init?: RequestInit) => {
      const url = normalizeRequestPath(input);
      const method = init?.method ?? 'GET';

      if (url === '/sales' && method === 'GET') {
        return Promise.resolve(jsonResponse({ items: salesQueue.shift() ?? refreshedSales }));
      }

      if (url === '/sessions' && method === 'POST') {
        return Promise.resolve(jsonResponse({ userToken: 'usr_tok_123', displayName: 'Avery' }));
      }

      if (url === '/reservations' && method === 'GET') {
        return Promise.resolve(jsonResponse({ items: [] }));
      }

      if (url.startsWith('/debug/observability')) {
        return Promise.resolve(toMockResponse(defaultObservabilitySnapshot({ displayName: 'Avery', sales: refreshedSales })));
      }

      if (url === '/sales/sale_jacket_002/reservations' && method === 'POST') {
        return Promise.resolve(jsonResponse({ status: 'SOLD_OUT' }));
      }

      throw new Error(`Unexpected fetch: ${method} ${url}`);
    });

    vi.stubGlobal('fetch', fetchMock);

    renderApp('/');
    fillLandingForm({ name: 'Avery', email: 'avery@example.com' });
    fireEvent.click(screen.getByRole('button', { name: 'Enter the sale' }));
    fireEvent.click(await screen.findByRole('button', { name: 'View product' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add to cart' }));

    expect(await screen.findByText('That product sold out before your hold could be created.')).toBeDefined();
    const activityQueries = within(await screen.findByRole('table', { name: 'Activity' }));
    expect(activityQueries.getByText('attempted add to cart')).toBeDefined();
    expect(activityQueries.getByText('Track Jacket could not be reserved because the product sold out.')).toBeDefined();
    const soldOutButton = await screen.findByRole('button', { name: 'Sold out' });
    expect((soldOutButton as HTMLButtonElement).disabled).toBe(true);
  });

  it('keeps an expired hold greyed out until manual removal while excluding it from checkout', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(new Date('2026-05-06T10:04:00Z').valueOf());

    const fetchMock = mockShopperEntryFetch({
      displayName: 'Jim',
      sales: [
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
      ],
      responses: [
        {
          status: 'RESERVED',
          reservationId: 'res_123',
          expiresAt: '2026-05-06T10:05:00Z',
          remainingStock: 9
        },
        {
          status: 'RESERVED',
          reservationId: 'res_jacket',
          expiresAt: '2026-05-06T10:03:00Z',
          remainingStock: 4
        }
      ]
    }).mockResolvedValueOnce({
      json: async () => ({ status: 'CANCELLED' })
    });

    vi.stubGlobal('fetch', fetchMock);

    renderApp('/');

    fillLandingForm({ name: 'Jim', email: 'jim@example.com' });
    fireEvent.click(screen.getByRole('button', { name: 'Enter the sale' }));

    fireEvent.click((await screen.findAllByRole('button', { name: 'View product' }))[0]);
    fireEvent.click(screen.getByRole('button', { name: 'Add to cart' }));
    fireEvent.click(screen.getByRole('button', { name: 'Back to products' }));

    fireEvent.click((await screen.findAllByRole('button', { name: 'View product' }))[1]);
    fireEvent.click(screen.getByRole('button', { name: 'Add to cart' }));
    fireEvent.click(screen.getByRole('button', { name: 'Go to checkout' }));

    const expiredCard = await screen.findByText('Track Jacket');
    const expiredArticle = expiredCard.closest('article') as HTMLElement;

    expect(within(expiredArticle).getAllByText('Expired')).toHaveLength(2);
    expect(within(expiredArticle).queryByRole('button', { name: 'Pay now' })).toBeNull();
    expect(within(expiredArticle).getByRole('button', { name: 'Remove from cart' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Pay now' })).toBeDefined();
    expect(screen.getByText('$88')).toBeDefined();
    expect(screen.queryByText('$206')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: '← Keep shopping' }));

    const revertedProductCard = (await screen.findAllByText('Track Jacket'))
      .map((node) => node.closest('article'))
      .find(
        (article): article is HTMLElement =>
          article instanceof HTMLElement && within(article).queryByRole('button', { name: 'View product' }) !== null
      ) as HTMLElement;

    expect(revertedProductCard).toBeDefined();
    expect(within(revertedProductCard).queryByText('Expired')).toBeNull();
    expect(within(revertedProductCard).getByRole('button', { name: 'View product' })).toBeDefined();
    expect(within(revertedProductCard).queryByText('Held')).toBeNull();
    expect(screen.queryByText('Your cart is empty.')).toBeNull();
    expect(await screen.findAllByText('Track Jacket')).toHaveLength(2);

    fireEvent.click(screen.getByRole('button', { name: 'Go to checkout' }));

    const refreshedExpiredArticle = (await screen.findAllByText('Track Jacket'))
      .map((node) => node.closest('article'))
      .find(
        (article): article is HTMLElement =>
          article instanceof HTMLElement && within(article).queryByText('This hold expired and was returned to stock. Remove it manually when you are done.') !== null
      ) as HTMLElement;

    expect(refreshedExpiredArticle).toBeDefined();

    fireEvent.click(within(refreshedExpiredArticle).getByRole('button', { name: 'Remove from cart' }));

    await waitFor(() => {
      expect(screen.queryByText('This hold expired and was returned to stock. Remove it manually when you are done.')).toBeNull();
    });
  });

  it('keeps both reserved items removed when checkout removals resolve out of order', async () => {
    let resolveFirstCancel: CancelResolver | null = null;
    let resolveSecondCancel: CancelResolver | null = null;

    const fetchMock = vi.fn((input: string | URL | Request, init?: RequestInit) => {
      const url = normalizeRequestPath(input);
      const method = init?.method ?? 'GET';

      if (url.startsWith('/debug/observability')) {
        return Promise.resolve(jsonResponse(defaultObservabilitySnapshot({ displayName: 'Jim', sales: [] })));
      }

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

    fillLandingForm({ name: 'Jim', email: 'jim@example.com' });
    fireEvent.click(screen.getByRole('button', { name: 'Enter the sale' }));

    fireEvent.click((await screen.findAllByRole('button', { name: 'View product' }))[0]);
    fireEvent.click(screen.getByRole('button', { name: 'Add to cart' }));
    expect(await screen.findByText('This item is held in your cart.')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Back to products' }));

    fireEvent.click((await screen.findAllByRole('button', { name: 'View product' }))[1]);
    fireEvent.click(screen.getByRole('button', { name: 'Add to cart' }));
    expect(await screen.findByText('This item is held in your cart.')).toBeDefined();
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
    expect((screen.getByRole('button', { name: 'Go to checkout' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('shows payment failures inline inside the payment modal', async () => {
    const fetchMock = mockShopperEntryFetch({
      displayName: 'Jim',
      sales: [
        {
          saleId: 'sale_jacket_002',
          itemName: 'Track Jacket',
          status: 'active',
          startsAt: '2026-05-06T10:00:00Z',
          endsAt: '2026-05-06T12:00:00Z',
          reservationTtlSeconds: 300
        }
      ],
      responses: [
        {
          status: 'RESERVED',
          reservationId: 'res_jacket',
          expiresAt: '2026-05-06T10:03:00Z',
          remainingStock: 4
        },
        { status: 'PAYMENT_FAILED', reservationId: 'res_jacket' }
      ]
    });

    vi.stubGlobal('fetch', fetchMock);

    renderApp('/');

    fillLandingForm({ name: 'Jim', email: 'jim@example.com' });
    fireEvent.click(screen.getByRole('button', { name: 'Enter the sale' }));
    fireEvent.click(await screen.findByRole('button', { name: 'View product' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add to cart' }));
    expect(await screen.findByText('This item is held in your cart.')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Go to checkout' }));

    fireEvent.click(screen.getByRole('button', { name: 'Pay now' }));
    fireEvent.click(screen.getByLabelText('Simulate payment failure'));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm payment' }));

    expect(
      await screen.findByText('Payment failed for Track Jacket. Your hold remains active.')
    ).toBeDefined();
    expect(screen.getByText('Pay for Track Jacket')).toBeDefined();
    const activityQueries = within(await screen.findByRole('table', { name: 'Activity' }));
    expect(activityQueries.getByText('attempted checkout')).toBeDefined();
    expect(activityQueries.getByText('Track Jacket payment failed and the hold remains active.')).toBeDefined();
  });

  it('records a frontend activity event when remove-from-cart is rejected because the reservation belongs to another session', async () => {
    const fetchMock = mockShopperEntryFetch({
      displayName: 'Jim',
      sales: [
        {
          saleId: 'sale_jacket_002',
          itemName: 'Track Jacket',
          status: 'active',
          startsAt: '2026-05-06T10:00:00Z',
          endsAt: '2026-05-06T12:00:00Z',
          reservationTtlSeconds: 300
        }
      ],
      responses: [
        {
          status: 'RESERVED',
          reservationId: 'res_jacket',
          expiresAt: '2026-05-06T10:03:00Z',
          remainingStock: 4
        },
        { status: 'FORBIDDEN' }
      ]
    });

    vi.stubGlobal('fetch', fetchMock);

    renderApp('/');

    fillLandingForm({ name: 'Jim', email: 'jim@example.com' });
    fireEvent.click(screen.getByRole('button', { name: 'Enter the sale' }));
    fireEvent.click(await screen.findByRole('button', { name: 'View product' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add to cart' }));
    expect(await screen.findByText('This item is held in your cart.')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Go to checkout' }));

    fireEvent.click(screen.getByRole('button', { name: 'Remove from cart' }));
    const activityQueries = within(await screen.findByRole('table', { name: 'Activity' }));
    expect(activityQueries.getByText('attempted remove')).toBeDefined();
    expect(activityQueries.getByText('Track Jacket could not be removed because it belongs to another session.')).toBeDefined();
  });

  it('keeps a purchased receipt inline with the checkout sort order and returns blue purchased cards on the product list', async () => {
    const fetchMock = mockShopperEntryFetch({
      displayName: 'Jim',
      sales: [
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
      ],
      responses: [
        {
          status: 'RESERVED',
          reservationId: 'res_123',
          expiresAt: '2026-05-06T10:05:00Z',
          remainingStock: 9
        },
        {
          status: 'RESERVED',
          reservationId: 'res_jacket',
          expiresAt: '2026-05-06T10:03:00Z',
          remainingStock: 4
        },
        {
          status: 'PURCHASED',
          reservationId: 'res_123',
          purchasedAt: '2026-05-06T10:02:00Z'
        },
        {
          status: 'PURCHASED',
          reservationId: 'res_jacket',
          purchasedAt: '2026-05-06T10:01:00Z'
        }
      ]
    });

    vi.stubGlobal('fetch', fetchMock);

    renderApp('/');

    fillLandingForm({ name: 'Jim', email: 'jim@example.com' });
    fireEvent.click(screen.getByRole('button', { name: 'Enter the sale' }));

    fireEvent.click((await screen.findAllByRole('button', { name: 'View product' }))[0]);
    fireEvent.click(screen.getByRole('button', { name: 'Add to cart' }));
    expect(await screen.findByText('This item is held in your cart.')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Back to products' }));

    fireEvent.click((await screen.findAllByRole('button', { name: 'View product' }))[1]);
    fireEvent.click(screen.getByRole('button', { name: 'Add to cart' }));
    expect(await screen.findByText('This item is held in your cart.')).toBeDefined();
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

function mockLandingSales(items?: Array<{
  saleId: string;
  itemName: string;
  status: 'upcoming' | 'active' | 'ended';
  startsAt: string;
  endsAt: string;
  reservationTtlSeconds: number;
  price?: number;
  remainingStock?: number;
}>) {
  return vi.fn().mockResolvedValueOnce({
    json: async () => ({
      items:
        items ??
        [
          {
            saleId: 'sale_founder_001',
            itemName: 'Founder Tee',
            status: 'active',
            startsAt: '2026-05-06T10:00:00Z',
            endsAt: '2026-05-06T12:00:00Z',
            reservationTtlSeconds: 180
          },
          {
            saleId: 'sale_cap_001',
            itemName: 'KooPiBi Cap',
            status: 'active',
            startsAt: '2026-05-06T10:00:00Z',
            endsAt: '2026-05-06T12:00:00Z',
            reservationTtlSeconds: 180
          }
        ]
    })
  });
}

function mockShopperEntryFetch({
  displayName,
  sales,
  reservations = [],
  responses = [],
  observability
}: {
  displayName: string;
  sales: Array<{
    saleId: string;
    itemName: string;
    status: 'upcoming' | 'active' | 'ended';
    startsAt: string;
    endsAt: string;
    reservationTtlSeconds: number;
    price?: number;
    remainingStock?: number;
  }>;
  reservations?: Array<Record<string, unknown>>;
  responses?: Array<Record<string, unknown>>;
  observability?: Record<string, unknown>;
}) {
  const reservationQueue = [{ items: reservations }];
  const actionQueue: Array<Record<string, unknown> | MockJsonResponse> = [...responses];

  const fetchMock = vi.fn((input: string | URL | Request, init?: RequestInit) => {
    const url = normalizeRequestPath(input);
    const method = init?.method ?? 'GET';

    if (url === '/sales' && method === 'GET') {
      return Promise.resolve(jsonResponse({ items: sales }));
    }

    if (url === '/sessions' && method === 'POST') {
      return Promise.resolve(jsonResponse({ userToken: 'usr_tok_123', displayName }));
    }

    if (url === '/reservations' && method === 'GET') {
      const nextReservation = reservationQueue.shift();

      if (nextReservation) {
        return Promise.resolve(jsonResponse(nextReservation));
      }

      const nextAction = actionQueue[0];
      if (nextAction && 'items' in nextAction) {
        return Promise.resolve(jsonResponse(actionQueue.shift() as Record<string, unknown>));
      }

      return Promise.resolve(jsonResponse({ items: [] }));
    }

    if (url.startsWith('/debug/observability')) {
      return Promise.resolve(toMockResponse(observability ?? defaultObservabilitySnapshot({ displayName, sales })));
    }

    if (url === '/debug/process-worker' && method === 'POST') {
      return Promise.resolve(
        jsonResponse({
          processed: { reservation: 0, purchase: 0, expiry: 0 },
          processedAt: '2026-05-05T10:00:00.000Z'
        })
      );
    }

    const next = actionQueue.shift();

    if (!next) {
      throw new Error(`Unexpected fetch: ${method} ${url}`);
    }

    return Promise.resolve(toMockResponse(next));
  });

  fetchMock.mockResolvedValueOnce = ((value: Record<string, unknown> | MockJsonResponse) => {
    actionQueue.push(value);
    return fetchMock;
  }) as typeof fetchMock.mockResolvedValueOnce;

  return fetchMock;
}

function defaultObservabilitySnapshot({
  displayName,
  sales
}: {
  displayName: string;
  sales: Array<{ status: 'upcoming' | 'active' | 'ended' }>;
}) {
  return {
    generatedAt: '2026-05-05T10:00:00.000Z',
    workerMode: 'manual',
    shopper: { userToken: 'usr_tok_123', displayName },
    app: {
      page: 'product-list',
      cartCount: 0,
      purchaseCount: 0,
      activeSaleCount: sales.filter((sale) => sale.status === 'active').length,
      userLabel: displayName,
      pendingSqsCount: 0
    },
    pipeline: [],
    redis: { status: 'ok', stockBySale: [], userReservationIds: [], reservations: [], expiryQueues: [] },
    sqs: { status: 'ok', queues: [] },
    dynamodb: { status: 'ok', tableName: 'flash-sale-reservations-local', shopperRecords: [] },
    manualWorker: {}
  };
}

function jsonResponse(payload: Record<string, unknown>) {
  return {
    json: async () => payload
  };
}

function toMockResponse(payload: Record<string, unknown> | MockJsonResponse) {
  return isMockJsonResponse(payload) ? payload : jsonResponse(payload);
}

function isMockJsonResponse(value: Record<string, unknown> | MockJsonResponse): value is MockJsonResponse {
  return typeof value === 'object' && value !== null && 'json' in value && typeof value.json === 'function';
}

function normalizeRequestPath(input: string | URL | Request) {
  if (input instanceof URL) {
    return input.pathname;
  }

  if (typeof input === 'string') {
    return input.startsWith('http') ? new URL(input).pathname : input;
  }

  return input.url.startsWith('http') ? new URL(input.url).pathname : input.url;
}

function fillLandingForm({ name, email }: { name: string; email: string }) {
  fireEvent.change(screen.getByLabelText('Name'), { target: { value: name } });
  fireEvent.change(screen.getByLabelText('Email Address'), { target: { value: email } });
}

async function flushApp() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}

function readPipelineTitles(pipeline: HTMLElement) {
  return Array.from(pipeline.children).map((card) => (card as HTMLElement).children[0]?.textContent ?? '');
}

function readTableOrder() {
  return screen.getAllByRole('table').map((table) => table.getAttribute('aria-label') ?? '');
}

function formatWindow(startsAt: string, endsAt: string) {
  const fmt = (value: string) => new Date(value).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  return `${fmt(startsAt)} - ${fmt(endsAt)}`;
}
