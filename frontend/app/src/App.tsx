import { useEffect, useState } from 'react';
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
import { CheckoutPage } from './pages/CheckoutPage';
import { ConfirmationPage } from './pages/ConfirmationPage';
import { LandingPage } from './pages/LandingPage';
import { ProductListPage } from './pages/ProductListPage';
import { ProductPage } from './pages/ProductPage';
import type { CartReservation, Notice, Page, PurchaseSummary } from './types';

export default function App() {
  const [session, setSession] = useState<SessionResponse | null>(null);
  const [draftDisplayName, setDraftDisplayName] = useState('');
  const [sales, setSales] = useState<SaleItem[]>([]);
  const [reservations, setReservations] = useState<ReservationItem[]>([]);
  const [selectedSaleId, setSelectedSaleId] = useState<string | null>(null);
  const [cart, setCart] = useState<CartReservation[]>([]);
  const [purchases, setPurchases] = useState<PurchaseSummary[]>([]);
  const [purchasedSaleIds, setPurchasedSaleIds] = useState<Set<string>>(new Set());
  const [isCreatingSession, setIsCreatingSession] = useState(false);
  const [isLoadingCatalog, setIsLoadingCatalog] = useState(false);
  const [isReserving, setIsReserving] = useState(false);
  const [isCheckingOutIds, setIsCheckingOutIds] = useState<Set<string>>(new Set());
  const [isCancellingIds, setIsCancellingIds] = useState<Set<string>>(new Set());
  const [simulateFailureIds, setSimulateFailureIds] = useState<Set<string>>(new Set());
  const [notice, setNotice] = useState<Notice | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const navigate = useNavigate();
  const location = useLocation();

  const routeMatch = matchPage(location.pathname);
  const page = routeMatch?.page ?? null;
  const routeSaleId = routeMatch?.page === 'product-page' ? routeMatch.saleId : null;
  const selectedSale = sales.find((sale) => sale.saleId === (routeSaleId ?? selectedSaleId)) ?? null;

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (routeSaleId) {
      setSelectedSaleId(routeSaleId);
    }
  }, [routeSaleId]);

  useEffect(() => {
    if (!session) return;
    let cancelled = false;

    const load = async () => {
      setIsLoadingCatalog(true);
      try {
        const [salesPayload, reservationPayload] = await Promise.all([
          listSales(),
          listReservations(session.userToken)
        ]);

        if (cancelled) return;

        const ordered = sortSales(salesPayload.items);
        setSales(ordered);
        setReservations(reservationPayload.items);
        setSelectedSaleId(
          (current) =>
            current ??
            ordered.find((sale) => sale.status === 'active')?.saleId ??
            ordered[0]?.saleId ??
            null
        );
        setCart((current) =>
          current.length > 0 ? current : deriveCartFromReservations(reservationPayload.items, ordered)
        );
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

    void load();

    return () => {
      cancelled = true;
    };
  }, [session]);

  async function handleCreateSession() {
    const displayName = draftDisplayName.trim();
    if (!displayName) return;

    setIsCreatingSession(true);
    setNotice(null);

    try {
      const nextSession = await createSession(displayName);
      setSession(nextSession);
      setSales([]);
      setReservations([]);
      setSelectedSaleId(null);
      setCart([]);
      setPurchases([]);
      setPurchasedSaleIds(new Set());
      setSimulateFailureIds(new Set());
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
        setNotice({
          tone: 'success',
          text: `${selectedSale.itemName} added to cart. ${result.remainingStock} units remain.`
        });
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
              expiresAt: existing.expiresAt
            }
          ]);
          setNotice({ tone: 'neutral', text: 'You already have an active hold for this product.' });
        } else {
          setNotice({ tone: 'warning', text: 'This product already has an active hold for this session.' });
        }
        return;
      }

      if (result.status === 'SOLD_OUT') {
        setNotice({ tone: 'warning', text: 'That product sold out before your hold could be created.' });
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

    setIsCancellingIds((current) => new Set([...current, reservationId]));
    setNotice(null);

    try {
      const result = await cancelReservation(reservationId, session.userToken);

      if (result.status === 'CANCELLED' || result.status === 'NOT_FOUND') {
        const nextCart = cart.filter((item) => item.reservationId !== reservationId);
        setCart(nextCart);
        setReservations((current) => current.filter((reservation) => reservation.reservationId !== reservationId));

        if (page === 'checkout' && nextCart.length === 0 && purchases.length === 0) {
          navigate('/products');
        }
        return;
      }

      if (result.status === 'ALREADY_PURCHASED') {
        setNotice({ tone: 'warning', text: 'That item has already been purchased.' });
        const refreshed = await listReservations(session.userToken);
        setReservations(refreshed.items);
        setCart(deriveCartFromReservations(refreshed.items, sales));
        return;
      }

      setNotice({ tone: 'warning', text: 'This reservation belongs to another session.' });
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

  async function handleBuyItem(reservationId: string) {
    if (!session) return;
    const cartItem = cart.find((item) => item.reservationId === reservationId);
    if (!cartItem) return;

    setIsCheckingOutIds((current) => new Set([...current, reservationId]));
    setNotice(null);

    try {
      const result = await checkoutReservationRequest(
        reservationId,
        session.userToken,
        nextRequestId(),
        simulateFailureIds.has(reservationId)
      );

      if (result.status === 'PAYMENT_FAILED') {
        setNotice({ tone: 'warning', text: `Payment failed for ${cartItem.itemName}. Your hold remains active.` });
        return;
      }

      setCart((current) => current.filter((item) => item.reservationId !== reservationId));
      setReservations((current) => current.filter((reservation) => reservation.reservationId !== reservationId));
      setPurchases((current) => [
        ...current,
        {
          reservationId,
          saleId: cartItem.saleId,
          itemName: cartItem.itemName,
          purchasedAt: result.purchasedAt
        }
      ]);
      setPurchasedSaleIds((current) => new Set([...current, cartItem.saleId]));
      setSimulateFailureIds((current) => {
        const next = new Set(current);
        next.delete(reservationId);
        return next;
      });
      setNotice({ tone: 'success', text: `${cartItem.itemName} purchased successfully.` });
    } catch {
      setNotice({ tone: 'warning', text: 'Unable to complete this purchase right now.' });
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
    setSelectedSaleId(saleId);
    setNotice(null);
    navigate(`/products/${encodeURIComponent(saleId)}`);
  }

  function handleBackToProducts() {
    setNotice(null);
    navigate('/products');
  }

  if (!page) return <Navigate to={session ? '/products' : '/'} replace />;
  if (!session && page !== 'landing') return <Navigate to="/" replace />;
  if (page === 'product-page' && !selectedSale && !isLoadingCatalog) return <Navigate to="/products" replace />;
  if (page === 'checkout' && cart.length === 0 && purchases.length === 0) return <Navigate to="/products" replace />;
  if (page === 'confirmation' && purchases.length === 0) return <Navigate to="/products" replace />;

  if (page === 'landing') {
    return (
      <LandingPage
        session={session}
        notice={notice}
        draftDisplayName={draftDisplayName}
        isCreatingSession={isCreatingSession}
        onDisplayNameChange={setDraftDisplayName}
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
        cart={cart}
        purchasedSaleIds={purchasedSaleIds}
        isLoadingCatalog={isLoadingCatalog}
        now={now}
        onViewProduct={handleViewProduct}
        onProceedToCheckout={() => navigate('/checkout')}
      />
    );
  }

  if (page === 'product-page' && selectedSale) {
    return (
      <ProductPage
        session={session}
        notice={notice}
        selectedSale={selectedSale}
        cart={cart}
        purchasedSaleIds={purchasedSaleIds}
        isReserving={isReserving}
        isCancellingIds={isCancellingIds}
        now={now}
        onAddToCart={() => void handleAddToCart()}
        onRemoveFromCart={(id) => void handleRemoveFromCart(id)}
        onProceedToCheckout={() => navigate('/checkout')}
        onBack={() => navigate('/products')}
      />
    );
  }

  if (page === 'checkout') {
    return (
      <CheckoutPage
        session={session}
        notice={notice}
        cart={cart}
        purchases={purchases}
        now={now}
        isCheckingOutIds={isCheckingOutIds}
        isCancellingIds={isCancellingIds}
        simulateFailureIds={simulateFailureIds}
        onBuyItem={(id) => void handleBuyItem(id)}
        onRemoveFromCart={(id) => void handleRemoveFromCart(id)}
        onToggleSimulateFailure={handleToggleSimulateFailure}
        onViewConfirmation={() => navigate('/confirmation')}
        onKeepShopping={() => navigate('/products')}
      />
    );
  }

  return (
    <ConfirmationPage
      session={session}
      notice={notice}
      purchases={purchases}
      onBack={handleBackToProducts}
    />
  );
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
      expiresAt: reservation.expiresAt
    }));
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
