import { useEffect, useRef, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import {
  cancelReservation,
  checkoutReservationRequest,
  createReservation,
  createSession,
  listReservations,
  listSales,
  type ReservationItem,
  type SaleItem,
  type SessionResponse
} from './api/client';
import { fetchObservabilitySnapshot, processWorkerNow as triggerWorkerNow } from './api/debugClient';
import { DeveloperDock } from './components/DeveloperDock';
import { CheckoutPage } from './pages/CheckoutPage';
import { ConfirmationPage } from './pages/ConfirmationPage';
import { LandingPage } from './pages/LandingPage';
import { ProductListPage } from './pages/ProductListPage';
import { ProductPage } from './pages/ProductPage';
import type {
  CartReservation,
  DeveloperDockEvent,
  DeveloperDockSource,
  Notice,
  ObservabilitySnapshot,
  Page,
  PurchaseSummary
} from './types';

const MAX_DEVELOPER_DOCK_EVENTS = 50;

function createDockEvent(
  source: DeveloperDockSource,
  action: string,
  effect: string,
  time = new Date().toISOString()
): DeveloperDockEvent {
  return { time, source, action, effect };
}

function prependDockEvents(current: DeveloperDockEvent[], nextEvents: DeveloperDockEvent[]) {
  if (nextEvents.length === 0) return current;
  return [...nextEvents, ...current].slice(0, MAX_DEVELOPER_DOCK_EVENTS);
}

function formatCount(value: number | null | undefined) {
  return value === null || value === undefined ? 'n/a' : String(value);
}

function diffObservabilitySnapshots(
  previous: ObservabilitySnapshot | null,
  current: ObservabilitySnapshot
): DeveloperDockEvent[] {
  if (!previous) return [];

  const events: DeveloperDockEvent[] = [];
  const snapshotTime = current.generatedAt;

  const previousStock = new Map(previous.redis.stockBySale.map((entry) => [entry.saleId, entry.stock]));
  for (const entry of current.redis.stockBySale) {
    if (previousStock.has(entry.saleId) && previousStock.get(entry.saleId) !== entry.stock) {
      events.push(
        createDockEvent(
          'redis',
          'stock changed',
          `${entry.saleId} stock ${formatCount(previousStock.get(entry.saleId))} -> ${formatCount(entry.stock)}.`,
          snapshotTime
        )
      );
    }
  }

  const previousReservations = new Map(previous.redis.reservations.map((entry) => [entry.reservationId, entry]));
  const currentReservations = new Map(current.redis.reservations.map((entry) => [entry.reservationId, entry]));

  for (const entry of current.redis.reservations) {
    const prior = previousReservations.get(entry.reservationId);
    if (!prior) {
      events.push(
        createDockEvent('redis', 'reservation appeared', `${entry.reservationId} created for ${entry.saleId}.`, snapshotTime)
      );
      continue;
    }

    if (prior.status !== entry.status) {
      events.push(
        createDockEvent(
          'redis',
          'reservation status changed',
          `${entry.reservationId} ${prior.status} -> ${entry.status}.`,
          snapshotTime
        )
      );
    }
  }

  for (const entry of previous.redis.reservations) {
    if (!currentReservations.has(entry.reservationId)) {
      events.push(
        createDockEvent('redis', 'reservation disappeared', `${entry.reservationId} left the Redis snapshot.`, snapshotTime)
      );
    }
  }

  const previousQueues = new Map(previous.sqs.queues.map((queue) => [queue.type, queue]));
  for (const queue of current.sqs.queues) {
    const prior = previousQueues.get(queue.type);
    if (!prior) continue;

    if (prior.visibleMessages !== queue.visibleMessages || prior.inFlightMessages !== queue.inFlightMessages) {
      events.push(
        createDockEvent(
          'sqs',
          'queue counts changed',
          `${queue.type} visible ${formatCount(prior.visibleMessages)} -> ${formatCount(queue.visibleMessages)}, in flight ${formatCount(prior.inFlightMessages)} -> ${formatCount(queue.inFlightMessages)}.`,
          snapshotTime
        )
      );
    }
  }

  const previousRecords = new Map(previous.dynamodb.shopperRecords.map((record) => [record.reservationId, record]));
  for (const record of current.dynamodb.shopperRecords) {
    const prior = previousRecords.get(record.reservationId);
    if (!prior) {
      events.push(
        createDockEvent('dynamodb', 'shopper record appeared', `${record.reservationId} stored for ${record.saleId}.`, snapshotTime)
      );
      continue;
    }

    if (prior.status !== record.status) {
      events.push(
        createDockEvent(
          'dynamodb',
          'shopper status changed',
          `${record.reservationId} ${prior.status} -> ${record.status}.`,
          snapshotTime
        )
      );
    }
  }

  if (
    current.manualWorker.lastRunAt &&
    current.manualWorker.lastRunAt !== previous.manualWorker.lastRunAt &&
    current.manualWorker.lastResult
  ) {
    events.push(
      createDockEvent(
        'worker',
        'processed queues',
        `reservation ${current.manualWorker.lastResult.reservation}, purchase ${current.manualWorker.lastResult.purchase}, expiry ${current.manualWorker.lastResult.expiry}.`,
        current.manualWorker.lastRunAt
      )
    );
  }

  return events;
}

export default function App() {
  const [session, setSession] = useState<SessionResponse | null>(null);
  const [draftDisplayName, setDraftDisplayName] = useState('');
  const [draftEmailAddress, setDraftEmailAddress] = useState('');
  const [sales, setSales] = useState<SaleItem[]>([]);
  const [reservations, setReservations] = useState<ReservationItem[]>([]);
  const [selectedSaleId, setSelectedSaleId] = useState<string | null>(null);
  const [cart, setCart] = useState<CartReservation[]>([]);
  const [expiredCart, setExpiredCart] = useState<CartReservation[]>([]);
  const [purchases, setPurchases] = useState<PurchaseSummary[]>([]);
  const [purchasedSaleIds, setPurchasedSaleIds] = useState<Set<string>>(new Set());
  const [activePaymentReservationId, setActivePaymentReservationId] = useState<string | null>(null);
  const [paymentConfirmationReservationId, setPaymentConfirmationReservationId] = useState<string | null>(null);
  const [isCreatingSession, setIsCreatingSession] = useState(false);
  const [isLoadingCatalog, setIsLoadingCatalog] = useState(false);
  const [isReserving, setIsReserving] = useState(false);
  const [isCheckingOutIds, setIsCheckingOutIds] = useState<Set<string>>(new Set());
  const [isCancellingIds, setIsCancellingIds] = useState<Set<string>>(new Set());
  const [simulateFailureIds, setSimulateFailureIds] = useState<Set<string>>(new Set());
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [observability, setObservability] = useState<ObservabilitySnapshot | null>(null);
  const [developerDockEvents, setDeveloperDockEvents] = useState<DeveloperDockEvent[]>([]);
  const [isProcessingWorker, setIsProcessingWorker] = useState(false);
  const [isRefreshingSnapshot, setIsRefreshingSnapshot] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const previousObservabilityRef = useRef<ObservabilitySnapshot | null>(null);
  const navigate = useNavigate();
  const location = useLocation();

  const routeMatch = matchPage(location.pathname);
  const page = routeMatch?.page ?? null;
  const routeSaleId = routeMatch?.page === 'product-page' ? routeMatch.saleId : null;
  const selectedSale = sales.find((sale) => sale.saleId === (routeSaleId ?? selectedSaleId)) ?? null;
  const visibleCart = mergeCart(cart, expiredCart, now);
  const activeCart = visibleCart.filter((item) => item.state !== 'expired');
  const activePaymentItem = activeCart.find((item) => item.reservationId === activePaymentReservationId) ?? null;
  const paymentConfirmationPurchase =
    purchases.find((purchase) => purchase.reservationId === paymentConfirmationReservationId) ?? null;
  const dockFallbackSummary: ObservabilitySnapshot['app'] = {
    page: page ?? 'unknown',
    cartCount: activeCart.length,
    purchaseCount: purchases.length,
    activeSaleCount: sales.filter((sale) => sale.status === 'active').length,
    userLabel: session?.displayName ?? 'Guest',
    userSessionLabel: session?.userToken ? `Session: ${session.userToken}` : undefined,
    pendingSqsCount: null
  };
  const developerDock = (
    <DeveloperDock
      snapshot={observability}
      events={developerDockEvents}
      fallbackSummary={dockFallbackSummary}
      isProcessingWorker={isProcessingWorker}
      isRefreshingSnapshot={isRefreshingSnapshot}
      onProcessWorkerNow={() => void handleProcessWorkerNow()}
      onRefreshSnapshot={() => void handleRefreshSnapshot()}
    />
  );

  function appendFrontendEvent(action: string, effect: string) {
    setDeveloperDockEvents((current) =>
      prependDockEvents(current, [createDockEvent('frontend', action, effect)])
    );
  }

  function appendFrontendEvents(events: Array<{ action: string; effect: string }>) {
    setDeveloperDockEvents((current) =>
      prependDockEvents(
        current,
        events.map((event) => createDockEvent('frontend', event.action, event.effect))
      )
    );
  }

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  async function refreshSalesCatalog() {
    const salesPayload = await listSales();
    const ordered = sortSales(salesPayload.items);

    setSales(ordered);
    setSelectedSaleId(
      (current) =>
        current ??
        ordered.find((sale) => sale.status === 'active')?.saleId ??
        ordered[0]?.saleId ??
        null
    );

    return ordered;
  }

  useEffect(() => {
    if (routeSaleId) {
      setSelectedSaleId(routeSaleId);
    }
  }, [routeSaleId]);

  useEffect(() => {
    let cancelled = false;

    const loadSales = async () => {
      setIsLoadingCatalog(true);
      try {
        await refreshSalesCatalog();
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

    void loadSales();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!session) {
      setReservations([]);
      setCart([]);
      setExpiredCart([]);
      return;
    }

    let cancelled = false;

    const loadReservations = async () => {
      try {
        const reservationPayload = await listReservations(session.userToken);

        if (cancelled) return;

        setReservations(reservationPayload.items);
         setCart(deriveCartFromReservations(reservationPayload.items, sales));
      } catch {
        if (!cancelled) {
          setNotice({ tone: 'warning', text: 'Unable to load the live catalog right now.' });
        }
      }
    };

    void loadReservations();

    return () => {
      cancelled = true;
    };
  }, [session, sales]);

  useEffect(() => {
    setExpiredCart((current) => {
      const activeReservationIds = new Set(cart.map((item) => item.reservationId));
      const nextExpired = current.filter((item) => !activeReservationIds.has(item.reservationId));
      const newlyExpired = cart
        .filter((item) => Date.parse(item.expiresAt) <= now)
        .map((item) => ({ ...item, state: 'expired' as const }));

      const merged = [...nextExpired];

      for (const item of newlyExpired) {
        if (!merged.some((existing) => existing.reservationId === item.reservationId)) {
          merged.push(item);
        }
      }

      return merged;
    });
  }, [cart, now]);

  useEffect(() => {
    if (page === 'landing' || !session) {
      setObservability(null);
      previousObservabilityRef.current = null;
      return;
    }

    let cancelled = false;

    async function loadObservability() {
      try {
        const snapshot = await refreshObservabilitySnapshot();

        if (!cancelled) {
          previousObservabilityRef.current = snapshot;
        }
      } catch {
        if (!cancelled) {
          setObservability(null);
        }
      }
    }

    void loadObservability();

    const id = window.setInterval(() => {
      void loadObservability();
    }, 3000);

    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [session?.userToken, session?.displayName, page, cart.length, purchases.length, sales, draftDisplayName]);

  async function refreshObservabilitySnapshot() {
    const snapshot = await fetchObservabilitySnapshot({
      userToken: session?.userToken,
      page: page ?? 'unknown',
      cartCount: cart.length,
      purchaseCount: purchases.length,
      activeSaleCount: sales.filter((sale) => sale.status === 'active').length,
      userLabel: session?.displayName ?? draftDisplayName.trim()
    });

    const previousSnapshot = previousObservabilityRef.current ?? observability;
    setDeveloperDockEvents((current) =>
      prependDockEvents(current, diffObservabilitySnapshots(previousSnapshot, snapshot))
    );
    previousObservabilityRef.current = snapshot;
    setObservability(snapshot);
    return snapshot;
  }

  async function refreshReservations(activeSales = sales) {
    if (!session) return [];

    const refreshed = await listReservations(session.userToken);
    setReservations(refreshed.items);
    setCart(deriveCartFromReservations(refreshed.items, activeSales));
    return refreshed.items;
  }

  async function refreshDockAfterAction() {
    if (!session || page === 'landing') return;

    await refreshObservabilitySnapshot();
  }

  async function handleCreateSession() {
    const displayName = draftDisplayName.trim();
    if (!displayName) return;

    setIsCreatingSession(true);
    setNotice(null);

    try {
      const nextSession = await createSession(displayName);
      setSession(nextSession);
      setReservations([]);
      setSelectedSaleId(null);
      setCart([]);
      setExpiredCart([]);
      setPurchases([]);
      setPurchasedSaleIds(new Set());
      setDraftEmailAddress('');
      setActivePaymentReservationId(null);
      setPaymentConfirmationReservationId(null);
      setSimulateFailureIds(new Set());
      setPaymentError(null);
      previousObservabilityRef.current = null;
      setDeveloperDockEvents([]);
      appendFrontendEvents([
        { action: 'navigated to products', effect: `${displayName} moved from landing to the products grid.` },
        { action: 'session created', effect: `${displayName} started a flash-sale session.` }
      ]);
      navigate('/products');
    } catch {
      setNotice({ tone: 'warning', text: 'Unable to create a session right now.' });
    } finally {
      setIsCreatingSession(false);
    }
  }

  async function handleAddToCart() {
    if (!session || !selectedSale) return;

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
        const nextCartItem: CartReservation = {
          reservationId: result.reservationId,
          saleId: selectedSale.saleId,
          itemName: selectedSale.itemName,
          price: selectedSale.price,
          expiresAt: result.expiresAt,
          remainingStock: result.remainingStock
        };

        setReservations((current) => [
          nextReservation,
          ...current.filter((reservation) => reservation.saleId !== selectedSale.saleId)
        ]);
        setCart((current) => [
          ...current.filter((item) => item.saleId !== selectedSale.saleId),
          nextCartItem
        ]);
        setExpiredCart((current) => current.filter((item) => item.saleId !== selectedSale.saleId));
        setNotice({
          tone: 'success',
          text: `${selectedSale.itemName} added to cart. ${result.remainingStock} units remain.`
        });
        await refreshDockAfterAction();
        return;
      }

      if (result.status === 'ALREADY_RESERVED') {
        const existing = reservations.find((reservation) => reservation.saleId === selectedSale.saleId);

        if (existing) {
          setCart((current) => [
            ...current.filter((item) => item.saleId !== selectedSale.saleId),
            {
              reservationId: existing.reservationId,
              saleId: selectedSale.saleId,
              itemName: selectedSale.itemName,
              price: selectedSale.price,
              expiresAt: existing.expiresAt,
              state: 'active'
            }
          ]);
          setExpiredCart((current) => current.filter((item) => item.saleId !== selectedSale.saleId));
          setNotice({ tone: 'neutral', text: 'You already have an active hold for this product.' });
          await refreshDockAfterAction();
        } else {
          const refreshed = await refreshReservations();
          const recovered = refreshed.find((reservation) => reservation.saleId === selectedSale.saleId);

          if (recovered) {
            setNotice({ tone: 'neutral', text: 'You already have an active hold for this product.' });
          } else {
            setNotice({ tone: 'warning', text: 'This product already has an active hold for this session.' });
          }

          await refreshDockAfterAction();
        }
        return;
      }

      if (result.status === 'SOLD_OUT') {
        setNotice({ tone: 'warning', text: 'That product sold out before your hold could be created.' });
        appendFrontendEvent(
          'attempted add to cart',
          `${selectedSale.itemName} could not be reserved because the product sold out.`
        );
        await refreshSalesCatalog();
        return;
      }

      if (result.status === 'SALE_NOT_ACTIVE') {
        setNotice({ tone: 'warning', text: 'This sale is not active right now.' });
        appendFrontendEvent(
          'attempted add to cart',
          `${selectedSale.itemName} could not be reserved because the sale is not active.`
        );
        return;
      }

      if (result.status === 'SALE_NOT_FOUND') {
        setNotice({ tone: 'warning', text: 'This product could not be found.' });
        appendFrontendEvent(
          'attempted add to cart',
          `${selectedSale.itemName} could not be reserved because the sale was not found.`
        );
        return;
      }

      if (result.status === 'USER_TOKEN_REQUIRED') {
        setNotice({ tone: 'warning', text: 'A shopper session is required before reserving a product.' });
        appendFrontendEvent(
          'attempted add to cart',
          `${selectedSale.itemName} could not be reserved because the shopper session was missing.`
        );
        return;
      }

      setNotice({ tone: 'warning', text: `Reservation returned ${result.status}.` });
    } catch {
      setNotice({ tone: 'warning', text: 'Unable to add this product to the cart right now.' });
    } finally {
      setIsReserving(false);
    }
  }

  async function handleRemoveFromCart(reservationId: string) {
    if (!session) return;
    const cartItem = visibleCart.find((item) => item.reservationId === reservationId);

    setIsCancellingIds((current) => new Set([...current, reservationId]));
    setNotice(null);

    try {
      const result = await cancelReservation(reservationId, session.userToken);

      if (result.status === 'CANCELLED' || result.status === 'NOT_FOUND') {
        setCart((current) => current.filter((item) => item.reservationId !== reservationId));
        setExpiredCart((current) => current.filter((item) => item.reservationId !== reservationId));
        setReservations((current) => current.filter((reservation) => reservation.reservationId !== reservationId));
        if (activePaymentReservationId === reservationId) {
          setActivePaymentReservationId(null);
          setPaymentError(null);
        }
        appendFrontendEvent('removed item from cart', `${cartItem?.itemName ?? reservationId} was removed from the cart.`);
        await refreshDockAfterAction();
        return;
      }

      if (result.status === 'ALREADY_PURCHASED') {
        setNotice({ tone: 'warning', text: 'That item has already been purchased.' });
        appendFrontendEvent(
          'attempted remove',
          `${cartItem?.itemName ?? reservationId} could not be removed because it was already purchased.`
        );
        await refreshReservations();
        await refreshDockAfterAction();
        return;
      }

      setNotice({ tone: 'warning', text: 'This reservation belongs to another session.' });
      appendFrontendEvent(
        'attempted remove',
        `${cartItem?.itemName ?? reservationId} could not be removed because it belongs to another session.`
      );
    } catch {
      setNotice({ tone: 'warning', text: 'Unable to remove this item right now.' });
    } finally {
      setIsCancellingIds((current) => {
        const next = new Set(current);
        next.delete(reservationId);
        return next;
      });
    }
  }

  function handleOpenPayment(reservationId: string) {
    const cartItem = activeCart.find((item) => item.reservationId === reservationId);
    setActivePaymentReservationId(reservationId);
    setPaymentConfirmationReservationId(null);
    setPaymentError(null);
    setNotice(null);
    appendFrontendEvent('opened payment', `Starting payment for ${cartItem?.itemName ?? reservationId}.`);
  }

  function handleClosePayment() {
    setActivePaymentReservationId(null);
    setPaymentError(null);
  }

  function handleClosePaymentConfirmation() {
    setPaymentConfirmationReservationId(null);
  }

  async function handleConfirmPayment() {
    if (!session) return;
    const cartItem = activePaymentItem;
    if (!cartItem) return;

    const reservationId = cartItem.reservationId;

    setIsCheckingOutIds((current) => new Set([...current, reservationId]));
    setNotice(null);
    setPaymentError(null);

    try {
      const result = await checkoutReservationRequest(
        reservationId,
        session.userToken,
        nextRequestId(),
        simulateFailureIds.has(reservationId)
      );

      if (result.status === 'PAYMENT_FAILED') {
        setPaymentError(`Payment failed for ${cartItem.itemName}. Your hold remains active.`);
        appendFrontendEvent('attempted checkout', `${cartItem.itemName} payment failed and the hold remains active.`);
        return;
      }

      if (result.status === 'RESERVATION_EXPIRED') {
        setActivePaymentReservationId(null);
        setPaymentError(null);
        setExpiredCart((current) => {
          const expiredItem = cartItem ? { ...cartItem, state: 'expired' as const } : null;
          if (!expiredItem) return current;
          return current.some((item) => item.reservationId === expiredItem.reservationId)
            ? current
            : [...current, expiredItem];
        });
        await refreshReservations();
        await refreshDockAfterAction();
        setNotice({
          tone: 'warning',
          text: `${cartItem.itemName} expired before checkout. The cart has been refreshed.`
        });
        return;
      }

      const nextPurchase: PurchaseSummary = {
        reservationId,
        saleId: cartItem.saleId,
        itemName: cartItem.itemName,
        price: cartItem.price,
        purchasedAt: result.purchasedAt,
        expiresAt: cartItem.expiresAt
      };

      setCart((current) => current.filter((item) => item.reservationId !== reservationId));
      setExpiredCart((current) => current.filter((item) => item.reservationId !== reservationId));
      setReservations((current) => current.filter((reservation) => reservation.reservationId !== reservationId));
      setPurchases((current) => [...current, nextPurchase]);
      setPurchasedSaleIds((current) => new Set([...current, cartItem.saleId]));
      setSimulateFailureIds((current) => {
        const next = new Set(current);
        next.delete(reservationId);
        return next;
      });
      setActivePaymentReservationId(null);
      setPaymentConfirmationReservationId(reservationId);
      appendFrontendEvent('confirmed payment', `${cartItem.itemName} moved from held to purchased.`);
      await refreshDockAfterAction();
    } catch {
      setPaymentError('Unable to complete this purchase right now.');
    } finally {
      setIsCheckingOutIds((current) => {
        const next = new Set(current);
        next.delete(reservationId);
        return next;
      });
    }
  }

  function handleToggleSimulateFailure(reservationId: string) {
    setSimulateFailureIds((current) => {
      const next = new Set(current);
      if (next.has(reservationId)) {
        next.delete(reservationId);
      } else {
        next.add(reservationId);
      }
      return next;
    });
  }

  function handleViewProduct(saleId: string) {
    const sale = sales.find((entry) => entry.saleId === saleId);
    setSelectedSaleId(saleId);
    setNotice(null);
    appendFrontendEvent('opened product detail', `Viewing ${sale?.itemName ?? saleId}.`);
    navigate(`/products/${encodeURIComponent(saleId)}`);
  }

  function handleBackToProducts() {
    setNotice(null);
    appendFrontendEvent('returned to products', 'Moved back to the products grid.');
    navigate('/products');
  }

  function handleOpenCheckout() {
    if (activeCart.length === 0) return;
    appendFrontendEvent(
      'opened checkout',
      `Reviewing ${activeCart.length} active cart item${activeCart.length === 1 ? '' : 's'}.`
    );
    navigate('/checkout');
  }

  async function handleProcessWorkerNow() {
    setIsProcessingWorker(true);
    appendFrontendEvent('manual worker triggered', 'Requested an immediate worker pass.');

    try {
      await triggerWorkerNow();
      await refreshObservabilitySnapshot();
    } finally {
      setIsProcessingWorker(false);
    }
  }

  async function handleRefreshSnapshot() {
    setIsRefreshingSnapshot(true);

    try {
      await refreshObservabilitySnapshot();
    } finally {
      setIsRefreshingSnapshot(false);
    }
  }

  if (!page) return <Navigate to={session ? '/products' : '/'} replace />;
  if (!session && page !== 'landing') return <Navigate to="/" replace />;
  if (page === 'product-page' && !selectedSale && !isLoadingCatalog) return <Navigate to="/products" replace />;
   if (page === 'checkout' && visibleCart.length === 0 && purchases.length === 0) return <Navigate to="/products" replace />;
  if (page === 'confirmation' && purchases.length === 0) return <Navigate to="/checkout" replace />;

  if (page === 'landing') {
    return (
        <LandingPage
          session={session}
          notice={notice}
          sales={sales}
          draftDisplayName={draftDisplayName}
          draftEmailAddress={draftEmailAddress}
          isCreatingSession={isCreatingSession}
          dock={developerDock}
        onDisplayNameChange={setDraftDisplayName}
        onEmailAddressChange={setDraftEmailAddress}
        onSubmit={() => void handleCreateSession()}
      />
    );
  }

  if (page === 'product-list') {
    return (
      <ProductListPage
        session={session}
        notice={notice}
        sales={sales}
        cart={activeCart}
        cartRailItems={visibleCart}
        purchasedSaleIds={purchasedSaleIds}
        isLoadingCatalog={isLoadingCatalog}
        now={now}
        dock={developerDock}
        onViewProduct={handleViewProduct}
        onProceedToCheckout={handleOpenCheckout}
      />
    );
  }

  if (page === 'product-page' && selectedSale) {
    return (
      <ProductPage
        session={session}
        notice={notice}
        selectedSale={selectedSale}
        cart={activeCart}
        cartRailItems={visibleCart}
        purchasedSaleIds={purchasedSaleIds}
        isReserving={isReserving}
        isCancellingIds={isCancellingIds}
        now={now}
        dock={developerDock}
        onAddToCart={() => void handleAddToCart()}
        onRemoveFromCart={(id) => void handleRemoveFromCart(id)}
        onProceedToCheckout={handleOpenCheckout}
        onBack={handleBackToProducts}
      />
    );
  }

  if (page === 'checkout') {
    return (
      <CheckoutPage
        session={session}
        notice={notice}
        sales={sales}
        cart={visibleCart}
        purchases={purchases}
        now={now}
        isCheckingOutIds={isCheckingOutIds}
        isCancellingIds={isCancellingIds}
        simulateFailureIds={simulateFailureIds}
        dock={developerDock}
        activePaymentItem={activePaymentItem}
        paymentConfirmationPurchase={paymentConfirmationPurchase}
        paymentError={paymentError}
        onOpenPayment={handleOpenPayment}
        onClosePayment={handleClosePayment}
        onConfirmPayment={() => void handleConfirmPayment()}
        onClosePaymentConfirmation={handleClosePaymentConfirmation}
        onRemoveFromCart={(id) => void handleRemoveFromCart(id)}
        onToggleSimulateFailure={handleToggleSimulateFailure}
        onKeepShopping={handleBackToProducts}
      />
    );
  }

  if (page === 'confirmation') {
    return (
      <ConfirmationPage
        session={session}
        notice={notice}
        purchases={purchases}
        dock={developerDock}
        onBack={handleBackToProducts}
      />
    );
  }

  return <Navigate to={session ? '/products' : '/'} replace />;
}

function matchPage(pathname: string): { page: Page; saleId?: string } | null {
  if (pathname === '/') return { page: 'landing' };
  if (pathname === '/products') return { page: 'product-list' };
  if (pathname.startsWith('/products/')) {
    const saleId = decodeURIComponent(pathname.slice('/products/'.length));
    return saleId.length > 0 ? { page: 'product-page', saleId } : null;
  }
  if (pathname === '/checkout') return { page: 'checkout' };
  if (pathname === '/confirmation') return { page: 'confirmation' };
  return null;
}

function deriveCartFromReservations(
  reservations: ReservationItem[],
  sales: SaleItem[]
): CartReservation[] {
  return reservations
    .filter((reservation) => reservation.status === 'RESERVED')
      .map((reservation) => ({
        reservationId: reservation.reservationId,
        saleId: reservation.saleId,
        itemName: sales.find((sale) => sale.saleId === reservation.saleId)?.itemName ?? reservation.saleId,
        price: sales.find((sale) => sale.saleId === reservation.saleId)?.price,
        expiresAt: reservation.expiresAt,
        state: 'active' as const
      }));
}

function mergeCart(activeCart: CartReservation[], expiredCart: CartReservation[], now: number) {
  const merged = [...expiredCart.filter((item) => item.state === 'expired')];

  for (const item of activeCart) {
    const nextItem = Date.parse(item.expiresAt) <= now ? { ...item, state: 'expired' as const } : item;
    const existingIndex = merged.findIndex((existing) => existing.reservationId === nextItem.reservationId);

    if (existingIndex >= 0) {
      merged[existingIndex] = nextItem;
    } else {
      merged.push(nextItem);
    }
  }

  return merged;
}

function sortSales(items: SaleItem[]) {
  const rank: Record<SaleItem['status'], number> = { active: 0, upcoming: 1, ended: 2 };
  return [...items].sort((a, b) => {
    const statusDelta = rank[a.status] - rank[b.status];
    return statusDelta !== 0 ? statusDelta : Date.parse(a.startsAt) - Date.parse(b.startsAt);
  });
}

function nextRequestId() {
  return globalThis.crypto?.randomUUID?.() ?? `req_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}
