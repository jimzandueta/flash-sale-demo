import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import {
  checkoutReservationRequest,
  createReservation,
  createSession,
  listReservations,
  listSales,
  type ReservationItem,
  type SaleItem,
  type SessionResponse
} from './api/client';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';

type Page =
  | 'landing'
  | 'product-list'
  | 'product-page'
  | 'checkout'
  | 'payment-confirmation'
  | 'confirmation';

type Notice = {
  tone: 'neutral' | 'success' | 'warning';
  text: string;
};

type CartReservation = {
  reservationId: string;
  saleId: string;
  itemName: string;
  expiresAt: string;
  remainingStock?: number;
};

type PurchaseSummary = {
  reservationId: string;
  saleId: string;
  itemName: string;
  purchasedAt: string;
};

const pageLabels: Record<Page, string> = {
  landing: 'Landing',
  'product-list': 'Product List',
  'product-page': 'Product Page',
  checkout: 'Checkout',
  'payment-confirmation': 'Payment Confirmation',
  confirmation: 'Order Confirmation'
};

const flow: Page[] = [
  'landing',
  'product-list',
  'product-page',
  'checkout',
  'payment-confirmation',
  'confirmation'
];

export default function App() {
  const [session, setSession] = useState<SessionResponse | null>(null);
  const [draftDisplayName, setDraftDisplayName] = useState('');
  const [sales, setSales] = useState<SaleItem[]>([]);
  const [reservations, setReservations] = useState<ReservationItem[]>([]);
  const [selectedSaleId, setSelectedSaleId] = useState<string | null>(null);
  const [cart, setCart] = useState<CartReservation | null>(null);
  const [purchase, setPurchase] = useState<PurchaseSummary | null>(null);
  const [isCreatingSession, setIsCreatingSession] = useState(false);
  const [isLoadingCatalog, setIsLoadingCatalog] = useState(false);
  const [isReserving, setIsReserving] = useState(false);
  const [isSubmittingCheckout, setIsSubmittingCheckout] = useState(false);
  const [simulateFailure, setSimulateFailure] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const navigate = useNavigate();
  const location = useLocation();
  const routeMatch = matchPage(location.pathname);
  const page = routeMatch?.page ?? null;
  const routeSaleId = routeMatch?.page === 'product-page' ? routeMatch.saleId : null;

  useEffect(() => {
    const intervalId = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    if (!routeSaleId) {
      return;
    }

    setSelectedSaleId(routeSaleId);
  }, [routeSaleId]);

  useEffect(() => {
    if (!session) {
      return;
    }

    let cancelled = false;

    const loadCatalog = async () => {
      setIsLoadingCatalog(true);

      try {
        const [salesPayload, reservationPayload] = await Promise.all([
          listSales(),
          listReservations(session.userToken)
        ]);

        if (cancelled) {
          return;
        }

        const orderedSales = sortSales(salesPayload.items);
        setSales(orderedSales);
        setReservations(reservationPayload.items);
        setSelectedSaleId(
          (current) =>
            current ??
            orderedSales.find((item) => item.status === 'active')?.saleId ??
            orderedSales[0]?.saleId ??
            null
        );
        setCart((current) => current ?? deriveCartFromReservations(reservationPayload.items, orderedSales));
      } catch {
        if (!cancelled) {
          setNotice({ tone: 'warning', text: 'Unable to load the live catalog right now.' });
        }
      } finally {
        if (!cancelled) {
          setIsLoadingCatalog(false);
        }
      }
    };

    void loadCatalog();

    return () => {
      cancelled = true;
    };
  }, [session]);

  const selectedSale = sales.find((sale) => sale.saleId === (routeSaleId ?? selectedSaleId)) ?? null;
  const activeHoldForSelectedSale = selectedSale
    ? reservations.find((reservation) => reservation.saleId === selectedSale.saleId) ?? null
    : null;

  async function handleCreateSession() {
    const displayName = draftDisplayName.trim();

    if (displayName.length === 0) {
      return;
    }

    setIsCreatingSession(true);
    setNotice(null);

    try {
      const nextSession = await createSession(displayName);
      setSession(nextSession);
      setSales([]);
      setReservations([]);
      setSelectedSaleId(null);
      setPurchase(null);
      setCart(null);
      navigate('/products');
    } catch {
      setNotice({ tone: 'warning', text: 'Unable to create a session right now.' });
    } finally {
      setIsCreatingSession(false);
    }
  }

  function handleViewProduct(saleId: string) {
    setSelectedSaleId(saleId);
    setNotice(null);
    navigate(productRoute(saleId));
  }

  async function handleAddToCart() {
    if (!session || !selectedSale) {
      return;
    }

    setIsReserving(true);
    setNotice(null);

    try {
      const result = await createReservation(selectedSale.saleId, session.userToken, nextRequestId());

      if (result.status === 'RESERVED') {
        const nextReservation: ReservationItem = {
          reservationId: result.reservationId,
          saleId: selectedSale.saleId,
          userToken: session.userToken,
          status: 'RESERVED',
          expiresAt: result.expiresAt
        };
        const nextCart: CartReservation = {
          reservationId: result.reservationId,
          saleId: selectedSale.saleId,
          itemName: selectedSale.itemName,
          expiresAt: result.expiresAt,
          remainingStock: result.remainingStock
        };

        setReservations((current) => [nextReservation, ...current.filter((item) => item.saleId !== selectedSale.saleId)]);
        setCart(nextCart);
        setSimulateFailure(false);
        navigate('/checkout');
        setNotice({
          tone: 'success',
          text: `${selectedSale.itemName} is now held in your cart. ${result.remainingStock} units remain in live stock.`
        });
        return;
      }

      if (result.status === 'ALREADY_RESERVED') {
        const matchingReservation = reservations.find((reservation) => reservation.saleId === selectedSale.saleId);

        if (matchingReservation) {
          setCart({
            reservationId: matchingReservation.reservationId,
            saleId: selectedSale.saleId,
            itemName: selectedSale.itemName,
            expiresAt: matchingReservation.expiresAt
          });
          navigate('/checkout');
          setNotice({ tone: 'neutral', text: 'You already have an active hold for this product. Pick up where you left off.' });
        } else {
          setNotice({ tone: 'warning', text: 'This product already has an active hold for this session.' });
        }

        return;
      }

      if (result.status === 'SOLD_OUT') {
        setNotice({ tone: 'warning', text: 'That product sold out before your hold could be created.' });
        return;
      }

      setNotice({ tone: 'warning', text: `Reservation request returned ${result.status}.` });
    } catch {
      setNotice({ tone: 'warning', text: 'Unable to add this product to the cart right now.' });
    } finally {
      setIsReserving(false);
    }
  }

  async function handleCheckout() {
    if (!session || !cart) {
      return;
    }

    setIsSubmittingCheckout(true);
    setNotice(null);

    try {
      const result = await checkoutReservationRequest(
        cart.reservationId,
        session.userToken,
        nextRequestId(),
        simulateFailure
      );

      if (result.status === 'PAYMENT_FAILED') {
        setNotice({ tone: 'warning', text: 'Payment failed. Your hold remains active until the timer expires.' });
        return;
      }

      setReservations((current) => current.filter((reservation) => reservation.reservationId !== cart.reservationId));
      setPurchase({
        reservationId: cart.reservationId,
        saleId: cart.saleId,
        itemName: cart.itemName,
        purchasedAt: result.purchasedAt
      });
      navigate('/payment-confirmation');
      setNotice({ tone: 'success', text: 'Payment authorization completed. Confirm the order details to finish the flow.' });
    } catch {
      setNotice({ tone: 'warning', text: 'Unable to complete checkout right now.' });
    } finally {
      setIsSubmittingCheckout(false);
    }
  }

  function handleContinueToConfirmation() {
    if (!purchase) {
      return;
    }

    navigate('/confirmation');
  }

  function handleStartAnotherOrder() {
    setCart(null);
    setPurchase(null);
    setSimulateFailure(false);
    setNotice(null);
    navigate('/products');
  }

  if (!page) {
    return <Navigate to={session ? '/products' : '/'} replace />;
  }

  if (!session && page !== 'landing') {
    return <Navigate to="/" replace />;
  }

  if (page === 'product-page' && !selectedSale && !isLoadingCatalog) {
    return <Navigate to="/products" replace />;
  }

  if (page === 'checkout' && !cart) {
    return <Navigate to={selectedSale ? productRoute(selectedSale.saleId) : '/products'} replace />;
  }

  if ((page === 'payment-confirmation' || page === 'confirmation') && !purchase) {
    return <Navigate to={cart ? '/checkout' : '/products'} replace />;
  }

  if (page === 'landing') {
    return (
      <PageShell
        page={page}
        title="Flash Sale Control Room"
        description="Enter the sale floor, scan the live catalog, and move a reserved product through checkout and confirmation without leaving the experience."
        session={session}
        notice={notice}
      >
        <section style={landingGrid}>
          <div style={landingCopy}>
            <span style={heroBadge}>Three-minute prep, five-minute holds, one fast funnel.</span>
            <h2 style={landingHeadline}>A sharper storefront flow for the flash-sale runbook.</h2>
            <p style={landingBody}>
              The operator experience now follows the same shape a shopper expects: landing, catalog, product detail,
              checkout, payment confirmation, and final order confirmation.
            </p>
            <div style={previewRail}>
              {flow.slice(1).map((step) => (
                <div key={step} style={previewChip}>
                  {pageLabels[step]}
                </div>
              ))}
            </div>
          </div>

          <form
            style={heroCard}
            onSubmit={(event) => {
              event.preventDefault();
              void handleCreateSession();
            }}
          >
            <label htmlFor="display-name" style={fieldLabel}>
              Display name
            </label>
            <input
              id="display-name"
              name="display-name"
              value={draftDisplayName}
              onChange={(event) => setDraftDisplayName(event.target.value)}
              placeholder="Jim"
              style={fieldInput}
              disabled={isCreatingSession}
            />
            <button type="submit" style={primaryButton} disabled={isCreatingSession || draftDisplayName.trim().length === 0}>
              {isCreatingSession ? 'Opening catalog...' : 'Start shopping'}
            </button>
            <p style={helperText}>Anonymous sessions are enough to walk the full reservation and checkout flow.</p>
          </form>
        </section>
      </PageShell>
    );
  }

  if (page === 'product-list') {
    return (
      <PageShell
        page={page}
        title="Product List"
        description="Scan the live catalog, spot which drops are active, and choose the next product to move into a timed hold."
        session={session}
        notice={notice}
        aside={
          <div style={metricCluster}>
            <MetricCard label="Active sales" value={String(sales.filter((sale) => sale.status === 'active').length)} />
            <MetricCard label="Live holds" value={String(reservations.length)} />
          </div>
        }
      >
        {isLoadingCatalog ? (
          <section style={contentCard}>
            <p style={loadingState}>Syncing the product board...</p>
          </section>
        ) : (
          <section style={productGrid}>
            {sales.map((sale) => {
              const isHeld = reservations.some((reservation) => reservation.saleId === sale.saleId);

              return (
                <article key={sale.saleId} style={productCard}>
                  <div style={productCardTop}>
                    <span style={statusPill(sale.status)}>{sale.status}</span>
                    <span style={holdText}>{sale.reservationTtlSeconds / 60} min hold</span>
                  </div>
                  <h2 style={productCardTitle}>{sale.itemName}</h2>
                  <p style={skuText}>{sale.saleId}</p>
                  <p style={windowText}>{formatWindow(sale.startsAt, sale.endsAt)}</p>
                  <p style={bodyText}>
                    {sale.status === 'active'
                      ? 'Reserve stock from the product page and move straight into checkout.'
                      : 'The detail page still shows timing and status, but checkout stays locked until the sale is active.'}
                  </p>
                  {isHeld ? <p style={holdBanner}>This session already has a live hold for this product.</p> : null}
                  <button type="button" style={secondaryButton} onClick={() => handleViewProduct(sale.saleId)}>
                    View product
                  </button>
                </article>
              );
            })}
          </section>
        )}
      </PageShell>
    );
  }

  if (page === 'product-page' && selectedSale) {
    const isActive = selectedSale.status === 'active';

    return (
      <PageShell
        page={page}
        title="Product Page"
        description="Product detail is where the timed hold starts. Use this page to convert a live sale into a cart reservation."
        session={session}
        notice={notice}
      >
        <section style={detailLayout}>
          <div style={detailHeroCard(selectedSale.saleId)}>
            <div style={detailHeroTop}>
              <span style={statusPill(selectedSale.status)}>{selectedSale.status}</span>
              <span style={detailCaption}>Flash drop detail</span>
            </div>
            <h2 style={detailTitle}>{selectedSale.itemName}</h2>
            <p style={detailLead}>{formatWindow(selectedSale.startsAt, selectedSale.endsAt)}</p>
            <div style={detailMetaGrid}>
              <DetailStat label="Sale ID" value={selectedSale.saleId} />
              <DetailStat label="Hold length" value={`${selectedSale.reservationTtlSeconds / 60} minutes`} />
              <DetailStat label="Status" value={selectedSale.status} />
            </div>
          </div>

          <div style={detailSidebar}>
            <div style={contentCard}>
              <p style={sectionEyebrow}>Decision point</p>
              <h3 style={sectionTitle}>Reserve before the window closes</h3>
              <p style={bodyText}>
                Adding to cart creates the backend reservation hold and carries that reservation ID into checkout.
              </p>
              {activeHoldForSelectedSale ? (
                <p style={holdBanner}>
                  Current hold expires in {formatRemaining(activeHoldForSelectedSale.expiresAt, now)}.
                </p>
              ) : null}
              <div style={buttonRow}>
                <button type="button" style={ghostButton} onClick={() => navigate('/products')}>
                  Back to product list
                </button>
                <button
                  type="button"
                  style={primaryButton}
                  disabled={!isActive || isReserving}
                  onClick={() => void handleAddToCart()}
                >
                  {isReserving ? 'Adding to cart...' : isActive ? 'Add to cart' : 'Currently unavailable'}
                </button>
              </div>
            </div>

            {cart?.saleId === selectedSale.saleId ? (
              <div style={contentCard}>
                <p style={sectionEyebrow}>Cart state</p>
                <h3 style={sectionTitle}>This product already has a live hold</h3>
                <p style={bodyText}>Reservation {cart.reservationId}</p>
                <button type="button" style={secondaryButton} onClick={() => navigate('/checkout')}>
                  Go to checkout
                </button>
              </div>
            ) : null}
          </div>
        </section>
      </PageShell>
    );
  }

  if (page === 'checkout' && cart) {
    return (
      <PageShell
        page={page}
        title="Checkout"
        description="The cart becomes a payment step here. The reservation stays visible so the operator can verify the right hold is being purchased."
        session={session}
        notice={notice}
      >
        <section style={checkoutLayout}>
          <div style={contentCard}>
            <p style={sectionEyebrow}>Cart summary</p>
            <h2 style={sectionTitle}>{cart.itemName}</h2>
            <div style={summaryList}>
              <SummaryRow label="Sale" value={cart.saleId} />
              <SummaryRow label="Reservation" value={cart.reservationId} />
              <SummaryRow label="Hold expires in" value={formatRemaining(cart.expiresAt, now)} />
              {typeof cart.remainingStock === 'number' ? (
                <SummaryRow label="Remaining stock after hold" value={String(cart.remainingStock)} />
              ) : null}
            </div>
          </div>

          <div style={contentCard}>
            <p style={sectionEyebrow}>Payment controls</p>
            <h3 style={sectionTitle}>Run the mocked payment path</h3>
            <label style={toggleRow}>
              <input
                type="checkbox"
                checked={simulateFailure}
                onChange={(event) => setSimulateFailure(event.target.checked)}
              />
              Simulate payment failure
            </label>
            <div style={buttonRow}>
              <button type="button" style={ghostButton} onClick={() => navigate(productRoute(cart.saleId))}>
                Back to product page
              </button>
              <button
                type="button"
                style={primaryButton}
                disabled={isSubmittingCheckout}
                onClick={() => void handleCheckout()}
              >
                {isSubmittingCheckout ? 'Authorizing payment...' : 'Confirm payment'}
              </button>
            </div>
          </div>
        </section>
      </PageShell>
    );
  }

  if (page === 'payment-confirmation' && purchase) {
    return (
      <PageShell
        page={page}
        title="Payment Confirmation"
        description="The reservation has moved through payment. This page captures the payment result before the shopper lands on the final order confirmation."
        session={session}
        notice={notice}
      >
        <section style={centerCardLayout}>
          <div style={celebrationCard}>
            <span style={successBadge}>Payment cleared</span>
            <h2 style={celebrationTitle}>Reservation {purchase.reservationId} is now a completed purchase.</h2>
            <p style={bodyText}>Purchased at {formatDateTime(purchase.purchasedAt)} for {purchase.itemName}.</p>
            <div style={summaryList}>
              <SummaryRow label="Sale" value={purchase.saleId} />
              <SummaryRow label="Reservation" value={purchase.reservationId} />
            </div>
            <div style={buttonRow}>
              <button type="button" style={ghostButton} onClick={handleStartAnotherOrder}>
                Back to product list
              </button>
              <button type="button" style={primaryButton} onClick={handleContinueToConfirmation}>
                View order confirmation
              </button>
            </div>
          </div>
        </section>
      </PageShell>
    );
  }

  return (
    <PageShell
      page="confirmation"
      title="Order Confirmation"
      description="The order is finalized here with the key details the operator would want to capture at the end of the funnel."
      session={session}
      notice={notice}
    >
      {purchase ? (
        <section style={confirmationLayout}>
          <div style={contentCard}>
            <p style={sectionEyebrow}>Order receipt</p>
            <h2 style={sectionTitle}>{purchase.itemName}</h2>
            <div style={summaryList}>
              <SummaryRow label="Reservation" value={purchase.reservationId} />
              <SummaryRow label="Sale" value={purchase.saleId} />
              <SummaryRow label="Purchased at" value={formatDateTime(purchase.purchasedAt)} />
              <SummaryRow label="Customer" value={session?.displayName ?? 'Anonymous session'} />
            </div>
          </div>

          <div style={contentCard}>
            <p style={sectionEyebrow}>What changed</p>
            <h3 style={sectionTitle}>This is the final confirmation page</h3>
            <p style={bodyText}>
              The storefront now has an explicit end state instead of dropping the user back into the operational dashboard after checkout.
            </p>
            <button type="button" style={primaryButton} onClick={handleStartAnotherOrder}>
              Start another order
            </button>
          </div>
        </section>
      ) : null}
    </PageShell>
  );
}

function PageShell({
  page,
  title,
  description,
  session,
  notice,
  children,
  aside
}: {
  page: Page;
  title: string;
  description: string;
  session: SessionResponse | null;
  notice: Notice | null;
  children: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <main style={shell}>
      <div style={backgroundGlowA} />
      <div style={backgroundGlowB} />

      <section style={frame}>
        <header style={masthead}>
          <div>
            <p style={brandMark}>Dropline / Flash Sale</p>
            <p style={pageKicker}>{pageLabels[page]}</p>
            <h1 style={pageTitle}>{title}</h1>
            <p style={pageDescription}>{description}</p>
          </div>

          <div style={mastheadSide}>
            <nav aria-label="Experience steps" style={flowRail}>
              {flow.map((step) => (
                <span key={step} style={stepChip(step, page)}>
                  {pageLabels[step]}
                </span>
              ))}
            </nav>

            {session ? (
              <div style={sessionCard}>
                <span style={sessionLabel}>Signed in as</span>
                <strong style={sessionValue}>{session.displayName}</strong>
                <span style={tokenText}>{session.userToken}</span>
              </div>
            ) : null}

            {aside}
          </div>
        </header>

        {notice ? <p style={noticeStyle(notice.tone)}>{notice.text}</p> : null}

        {children}
      </section>
    </main>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div style={metricCard}>
      <span style={metricLabel}>{label}</span>
      <strong style={metricValue}>{value}</strong>
    </div>
  );
}

function DetailStat({ label, value }: { label: string; value: string }) {
  return (
    <div style={detailStatCard}>
      <span style={metricLabel}>{label}</span>
      <strong style={detailStatValue}>{value}</strong>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={summaryRow}>
      <span style={summaryLabel}>{label}</span>
      <span style={summaryValue}>{value}</span>
    </div>
  );
}

function deriveCartFromReservations(reservations: ReservationItem[], sales: SaleItem[]) {
  const reservation = reservations[0];

  if (!reservation) {
    return null;
  }

  const matchingSale = sales.find((sale) => sale.saleId === reservation.saleId);

  return {
    reservationId: reservation.reservationId,
    saleId: reservation.saleId,
    itemName: matchingSale?.itemName ?? reservation.saleId,
    expiresAt: reservation.expiresAt
  } satisfies CartReservation;
}

function sortSales(items: SaleItem[]) {
  const rank: Record<SaleItem['status'], number> = {
    active: 0,
    upcoming: 1,
    ended: 2
  };

  return [...items].sort((left, right) => {
    const statusDiff = rank[left.status] - rank[right.status];

    if (statusDiff !== 0) {
      return statusDiff;
    }

    return Date.parse(left.startsAt) - Date.parse(right.startsAt);
  });
}

function formatWindow(startsAt: string, endsAt: string) {
  return `${formatTime(startsAt)} - ${formatTime(endsAt)}`;
}

function formatTime(value: string) {
  return new Date(value).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });
}

function formatRemaining(expiresAt: string, now: number) {
  const remainingMs = Date.parse(expiresAt) - now;

  if (remainingMs <= 0) {
    return '0:00';
  }

  const totalSeconds = Math.floor(remainingMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function nextRequestId() {
  return globalThis.crypto?.randomUUID?.() ?? `req_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function matchPage(pathname: string): { page: Page; saleId?: string } | null {
  if (pathname === '/') {
    return { page: 'landing' };
  }

  if (pathname === '/products') {
    return { page: 'product-list' };
  }

  if (pathname.startsWith('/products/')) {
    const saleId = decodeURIComponent(pathname.slice('/products/'.length));

    if (saleId.length === 0) {
      return null;
    }

    return { page: 'product-page', saleId };
  }

  if (pathname === '/checkout') {
    return { page: 'checkout' };
  }

  if (pathname === '/payment-confirmation') {
    return { page: 'payment-confirmation' };
  }

  if (pathname === '/confirmation') {
    return { page: 'confirmation' };
  }

  return null;
}

function productRoute(saleId: string) {
  return `/products/${encodeURIComponent(saleId)}`;
}

function stepChip(step: Page, currentPage: Page): CSSProperties {
  const currentIndex = flow.indexOf(currentPage);
  const stepIndex = flow.indexOf(step);
  const isActive = step === currentPage;
  const isComplete = stepIndex < currentIndex;

  return {
    ...baseChip,
    background: isActive ? '#0f3b3a' : isComplete ? 'rgba(15, 59, 58, 0.14)' : 'rgba(255, 255, 255, 0.6)',
    color: isActive ? '#fff6eb' : isComplete ? '#0f3b3a' : '#5d6a73',
    borderColor: isActive ? '#0f3b3a' : 'rgba(15, 59, 58, 0.12)'
  };
}

function statusPill(status: SaleItem['status']): CSSProperties {
  const palette: Record<SaleItem['status'], { background: string; color: string }> = {
    active: { background: 'rgba(39, 119, 83, 0.12)', color: '#206241' },
    upcoming: { background: 'rgba(192, 121, 26, 0.14)', color: '#8f540f' },
    ended: { background: 'rgba(96, 111, 125, 0.14)', color: '#4d5966' }
  };

  return {
    ...baseChip,
    background: palette[status].background,
    color: palette[status].color,
    borderColor: 'transparent'
  };
}

function noticeStyle(tone: Notice['tone']): CSSProperties {
  return {
    ...noticeBase,
    background:
      tone === 'success'
        ? 'rgba(39, 119, 83, 0.12)'
        : tone === 'warning'
          ? 'rgba(183, 79, 39, 0.14)'
          : 'rgba(15, 59, 58, 0.1)',
    color: tone === 'success' ? '#206241' : tone === 'warning' ? '#8a3d20' : '#0f3b3a'
  };
}

function detailHeroCard(seed: string): CSSProperties {
  const hue = seed.length * 13;

  return {
    ...contentCard,
    minHeight: '100%',
    background: `linear-gradient(145deg, hsla(${hue % 360}, 73%, 88%, 0.92) 0%, rgba(255, 248, 238, 0.95) 42%, rgba(229, 241, 255, 0.92) 100%)`
  };
}

const baseChip: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: '2rem',
  padding: '0.4rem 0.75rem',
  borderRadius: '999px',
  border: '1px solid',
  fontSize: '0.76rem',
  fontWeight: 700,
  letterSpacing: '0.08em',
  textTransform: 'uppercase'
};

const shell: CSSProperties = {
  position: 'relative',
  minHeight: '100vh',
  padding: 'clamp(1rem, 3vw, 2.4rem)',
  background: 'linear-gradient(160deg, #f7ecdc 0%, #fff8ef 38%, #dbeafe 100%)',
  fontFamily: 'Avenir Next, Gill Sans, sans-serif',
  overflow: 'hidden'
};

const backgroundGlowA: CSSProperties = {
  position: 'absolute',
  inset: 'auto auto 12% -8%',
  width: '26rem',
  height: '26rem',
  borderRadius: '999px',
  background: 'radial-gradient(circle, rgba(214, 91, 55, 0.22) 0%, rgba(214, 91, 55, 0) 68%)',
  pointerEvents: 'none'
};

const backgroundGlowB: CSSProperties = {
  position: 'absolute',
  inset: '-8% -4% auto auto',
  width: '24rem',
  height: '24rem',
  borderRadius: '999px',
  background: 'radial-gradient(circle, rgba(15, 59, 58, 0.16) 0%, rgba(15, 59, 58, 0) 68%)',
  pointerEvents: 'none'
};

const frame: CSSProperties = {
  position: 'relative',
  zIndex: 1,
  display: 'grid',
  gap: '1.4rem',
  maxWidth: '1180px',
  margin: '0 auto'
};

const masthead: CSSProperties = {
  display: 'grid',
  gap: '1.4rem',
  gridTemplateColumns: 'minmax(0, 1.2fr) minmax(300px, 0.9fr)',
  alignItems: 'start'
};

const mastheadSide: CSSProperties = {
  display: 'grid',
  gap: '0.9rem'
};

const brandMark: CSSProperties = {
  margin: 0,
  fontSize: '0.82rem',
  letterSpacing: '0.18em',
  textTransform: 'uppercase',
  color: '#8f540f'
};

const pageKicker: CSSProperties = {
  margin: '0.8rem 0 0',
  fontSize: '0.9rem',
  fontWeight: 700,
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
  color: '#0f3b3a'
};

const pageTitle: CSSProperties = {
  margin: '0.35rem 0 0.7rem',
  fontFamily: 'Iowan Old Style, Palatino Linotype, serif',
  fontSize: 'clamp(2.6rem, 5vw, 4.6rem)',
  lineHeight: 0.98,
  color: '#18242f'
};

const pageDescription: CSSProperties = {
  margin: 0,
  maxWidth: '46rem',
  color: '#48606f',
  lineHeight: 1.65,
  fontSize: '1rem'
};

const flowRail: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '0.55rem'
};

const sessionCard: CSSProperties = {
  display: 'grid',
  gap: '0.25rem',
  padding: '1rem 1.1rem',
  borderRadius: '1.2rem',
  background: 'rgba(255, 255, 255, 0.76)',
  border: '1px solid rgba(15, 59, 58, 0.08)',
  boxShadow: '0 22px 40px rgba(24, 36, 47, 0.08)'
};

const sessionLabel: CSSProperties = {
  fontSize: '0.78rem',
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
  color: '#7b8a95'
};

const sessionValue: CSSProperties = {
  color: '#18242f'
};

const tokenText: CSSProperties = {
  fontSize: '0.88rem',
  color: '#48606f',
  overflowWrap: 'anywhere'
};

const noticeBase: CSSProperties = {
  margin: 0,
  padding: '0.95rem 1rem',
  borderRadius: '1rem',
  border: '1px solid transparent',
  lineHeight: 1.5
};

const landingGrid: CSSProperties = {
  display: 'grid',
  gap: '1.2rem',
  gridTemplateColumns: 'minmax(0, 1.1fr) minmax(320px, 420px)',
  alignItems: 'stretch'
};

const landingCopy: CSSProperties = {
  display: 'grid',
  gap: '1rem',
  alignContent: 'start',
  padding: '1.8rem 0.2rem'
};

const heroBadge: CSSProperties = {
  ...baseChip,
  alignSelf: 'start',
  background: 'rgba(255, 255, 255, 0.7)',
  color: '#0f3b3a',
  borderColor: 'rgba(15, 59, 58, 0.12)'
};

const landingHeadline: CSSProperties = {
  margin: 0,
  fontFamily: 'Iowan Old Style, Palatino Linotype, serif',
  fontSize: 'clamp(2.1rem, 4.5vw, 4rem)',
  lineHeight: 1,
  color: '#18242f'
};

const landingBody: CSSProperties = {
  margin: 0,
  maxWidth: '38rem',
  lineHeight: 1.7,
  color: '#48606f'
};

const previewRail: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '0.65rem'
};

const previewChip: CSSProperties = {
  ...baseChip,
  background: 'rgba(255, 255, 255, 0.72)',
  color: '#5d6a73',
  borderColor: 'rgba(15, 59, 58, 0.1)'
};

const heroCard: CSSProperties = {
  display: 'grid',
  gap: '0.9rem',
  padding: '1.4rem',
  borderRadius: '1.6rem',
  background: 'rgba(255, 255, 255, 0.78)',
  border: '1px solid rgba(15, 59, 58, 0.08)',
  boxShadow: '0 26px 56px rgba(24, 36, 47, 0.1)'
};

const fieldLabel: CSSProperties = {
  fontWeight: 700,
  color: '#18242f'
};

const fieldInput: CSSProperties = {
  width: '100%',
  padding: '0.95rem 1rem',
  borderRadius: '1rem',
  border: '1px solid rgba(15, 59, 58, 0.14)',
  background: '#fffdf9',
  fontSize: '1rem'
};

const helperText: CSSProperties = {
  margin: 0,
  fontSize: '0.9rem',
  color: '#5d6a73',
  lineHeight: 1.5
};

const productGrid: CSSProperties = {
  display: 'grid',
  gap: '1rem',
  gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))'
};

const productCard: CSSProperties = {
  display: 'grid',
  gap: '0.8rem',
  padding: '1.2rem',
  borderRadius: '1.4rem',
  background: 'rgba(255, 255, 255, 0.84)',
  border: '1px solid rgba(15, 59, 58, 0.08)',
  boxShadow: '0 20px 40px rgba(24, 36, 47, 0.08)'
};

const productCardTop: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: '0.75rem',
  alignItems: 'center'
};

const productCardTitle: CSSProperties = {
  margin: 0,
  fontFamily: 'Iowan Old Style, Palatino Linotype, serif',
  fontSize: '1.6rem',
  color: '#18242f'
};

const skuText: CSSProperties = {
  margin: 0,
  color: '#5d6a73',
  fontSize: '0.88rem'
};

const windowText: CSSProperties = {
  margin: 0,
  fontWeight: 700,
  color: '#0f3b3a'
};

const bodyText: CSSProperties = {
  margin: 0,
  color: '#48606f',
  lineHeight: 1.6
};

const holdText: CSSProperties = {
  fontSize: '0.8rem',
  color: '#5d6a73'
};

const holdBanner: CSSProperties = {
  margin: 0,
  padding: '0.8rem 0.9rem',
  borderRadius: '1rem',
  background: 'rgba(15, 59, 58, 0.08)',
  color: '#0f3b3a',
  lineHeight: 1.5
};

const metricCluster: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: '0.8rem'
};

const metricCard: CSSProperties = {
  display: 'grid',
  gap: '0.35rem',
  padding: '1rem',
  borderRadius: '1rem',
  background: 'rgba(255, 255, 255, 0.78)',
  border: '1px solid rgba(15, 59, 58, 0.08)'
};

const metricLabel: CSSProperties = {
  fontSize: '0.78rem',
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
  color: '#7b8a95'
};

const metricValue: CSSProperties = {
  fontSize: '1.5rem',
  color: '#18242f'
};

const detailLayout: CSSProperties = {
  display: 'grid',
  gap: '1rem',
  gridTemplateColumns: 'minmax(0, 1.2fr) minmax(320px, 0.8fr)'
};

const detailHeroTop: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: '0.75rem',
  alignItems: 'center'
};

const detailCaption: CSSProperties = {
  fontSize: '0.82rem',
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
  color: '#0f3b3a'
};

const detailTitle: CSSProperties = {
  margin: '1.4rem 0 0.6rem',
  fontFamily: 'Iowan Old Style, Palatino Linotype, serif',
  fontSize: 'clamp(2.2rem, 4vw, 3.5rem)',
  lineHeight: 1,
  color: '#18242f'
};

const detailLead: CSSProperties = {
  margin: 0,
  color: '#335464',
  lineHeight: 1.6
};

const detailMetaGrid: CSSProperties = {
  display: 'grid',
  gap: '0.75rem',
  gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
  marginTop: '1.5rem'
};

const detailSidebar: CSSProperties = {
  display: 'grid',
  gap: '1rem'
};

const detailStatCard: CSSProperties = {
  display: 'grid',
  gap: '0.35rem',
  padding: '0.95rem',
  borderRadius: '1rem',
  background: 'rgba(255, 255, 255, 0.72)',
  border: '1px solid rgba(15, 59, 58, 0.08)'
};

const detailStatValue: CSSProperties = {
  color: '#18242f'
};

const sectionEyebrow: CSSProperties = {
  margin: 0,
  fontSize: '0.78rem',
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
  color: '#8f540f'
};

const sectionTitle: CSSProperties = {
  margin: '0.35rem 0 0.7rem',
  fontFamily: 'Iowan Old Style, Palatino Linotype, serif',
  fontSize: '1.7rem',
  color: '#18242f'
};

const contentCard: CSSProperties = {
  display: 'grid',
  gap: '0.9rem',
  padding: '1.3rem',
  borderRadius: '1.4rem',
  background: 'rgba(255, 255, 255, 0.84)',
  border: '1px solid rgba(15, 59, 58, 0.08)',
  boxShadow: '0 18px 40px rgba(24, 36, 47, 0.08)'
};

const checkoutLayout: CSSProperties = {
  display: 'grid',
  gap: '1rem',
  gridTemplateColumns: 'minmax(0, 1fr) minmax(320px, 0.9fr)'
};

const summaryList: CSSProperties = {
  display: 'grid',
  gap: '0.65rem'
};

const summaryRow: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: '1rem',
  padding: '0.8rem 0.9rem',
  borderRadius: '0.95rem',
  background: '#fff9f0'
};

const summaryLabel: CSSProperties = {
  color: '#7b8a95'
};

const summaryValue: CSSProperties = {
  color: '#18242f',
  fontWeight: 700,
  textAlign: 'right',
  overflowWrap: 'anywhere'
};

const toggleRow: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.65rem',
  color: '#335464'
};

const buttonRow: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '0.75rem'
};

const centerCardLayout: CSSProperties = {
  display: 'grid',
  justifyItems: 'center'
};

const celebrationCard: CSSProperties = {
  display: 'grid',
  gap: '1rem',
  width: 'min(100%, 700px)',
  padding: '1.6rem',
  borderRadius: '1.6rem',
  background: 'linear-gradient(145deg, rgba(255, 255, 255, 0.9) 0%, rgba(231, 246, 239, 0.92) 100%)',
  border: '1px solid rgba(39, 119, 83, 0.12)',
  boxShadow: '0 24px 60px rgba(24, 36, 47, 0.08)'
};

const successBadge: CSSProperties = {
  ...baseChip,
  alignSelf: 'start',
  background: 'rgba(39, 119, 83, 0.14)',
  color: '#206241',
  borderColor: 'transparent'
};

const celebrationTitle: CSSProperties = {
  margin: 0,
  fontFamily: 'Iowan Old Style, Palatino Linotype, serif',
  fontSize: 'clamp(2rem, 4vw, 3rem)',
  lineHeight: 1.05,
  color: '#18242f'
};

const confirmationLayout: CSSProperties = {
  display: 'grid',
  gap: '1rem',
  gridTemplateColumns: 'minmax(0, 1fr) minmax(320px, 0.9fr)'
};

const primaryButton: CSSProperties = {
  border: 'none',
  borderRadius: '999px',
  padding: '0.9rem 1.15rem',
  fontWeight: 700,
  fontSize: '0.98rem',
  cursor: 'pointer',
  background: '#b74f27',
  color: '#fff6eb'
};

const secondaryButton: CSSProperties = {
  border: 'none',
  borderRadius: '999px',
  padding: '0.85rem 1rem',
  fontWeight: 700,
  fontSize: '0.96rem',
  cursor: 'pointer',
  background: '#0f3b3a',
  color: '#fff6eb'
};

const ghostButton: CSSProperties = {
  border: '1px solid rgba(15, 59, 58, 0.18)',
  borderRadius: '999px',
  padding: '0.85rem 1rem',
  fontWeight: 700,
  fontSize: '0.96rem',
  cursor: 'pointer',
  background: 'transparent',
  color: '#0f3b3a'
};

const loadingState: CSSProperties = {
  margin: 0,
  color: '#48606f',
  lineHeight: 1.6
};
