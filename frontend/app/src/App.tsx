import { useEffect, useState } from 'react';
import {
  checkoutReservationRequest,
  createReservation,
  createSession,
  listReservations,
  listSales,
  type CheckoutResponse,
  type ReservationItem,
  type SaleItem,
  type SessionResponse
} from './api/client';
import { CheckoutPanel } from './components/CheckoutPanel';
import { DisplayNameGate } from './components/DisplayNameGate';
import { ReservationPanel } from './components/ReservationPanel';
import { SaleList } from './components/SaleList';

export default function App() {
  const [session, setSession] = useState<SessionResponse | null>(null);
  const [draftDisplayName, setDraftDisplayName] = useState('');
  const [sales, setSales] = useState<SaleItem[]>([]);
  const [reservations, setReservations] = useState<ReservationItem[]>([]);
  const [selectedReservationId, setSelectedReservationId] = useState<string | null>(null);
  const [isCreatingSession, setIsCreatingSession] = useState(false);
  const [isLoadingDashboard, setIsLoadingDashboard] = useState(false);
  const [pendingSaleId, setPendingSaleId] = useState<string | null>(null);
  const [simulateFailure, setSimulateFailure] = useState(false);
  const [isSubmittingCheckout, setIsSubmittingCheckout] = useState(false);
  const [checkoutResult, setCheckoutResult] = useState<CheckoutResponse | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!session) {
      return;
    }

    let cancelled = false;

    const loadDashboard = async () => {
      setIsLoadingDashboard(true);

      try {
        const [salesPayload, reservationPayload] = await Promise.all([
          listSales(),
          listReservations(session.userToken)
        ]);

        if (cancelled) {
          return;
        }

        setSales(salesPayload.items);
        setReservations(reservationPayload.items);
        setSelectedReservationId((currentSelection) =>
          currentSelection ?? reservationPayload.items[0]?.reservationId ?? null
        );
      } catch {
        if (!cancelled) {
          setNotice('Unable to load the dashboard right now.');
        }
      } finally {
        if (!cancelled) {
          setIsLoadingDashboard(false);
        }
      }
    };

    void loadDashboard();

    return () => {
      cancelled = true;
    };
  }, [session]);

  const selectedReservation = reservations.find(
    (reservation) => reservation.reservationId === selectedReservationId
  ) ?? null;

  async function refreshReservations(userToken: string) {
    const reservationPayload = await listReservations(userToken);
    setReservations(reservationPayload.items);
    setSelectedReservationId((currentSelection) => {
      if (currentSelection && reservationPayload.items.some((item) => item.reservationId === currentSelection)) {
        return currentSelection;
      }

      return reservationPayload.items[0]?.reservationId ?? null;
    });
  }

  async function handleCreateSession() {
    if (draftDisplayName.trim().length === 0) {
      return;
    }

    setIsCreatingSession(true);
    setNotice(null);

    try {
      const nextSession = await createSession(draftDisplayName.trim());
      setSession(nextSession);
    } catch {
      setNotice('Unable to create a session right now.');
    } finally {
      setIsCreatingSession(false);
    }
  }

  async function handleReserve(saleId: string) {
    if (!session) {
      return;
    }

    setPendingSaleId(saleId);
    setCheckoutResult(null);
    setNotice(null);

    try {
      const result = await createReservation(saleId, session.userToken, nextRequestId());

      if (result.status === 'RESERVED') {
        setNotice(`Reserved ${saleId}. ${result.remainingStock} units remain in live stock.`);
        await refreshReservations(session.userToken);
        setSelectedReservationId(result.reservationId);
      } else if (result.status === 'ALREADY_RESERVED') {
        setNotice('This user already holds an active reservation for that sale.');
      } else if (result.status === 'SOLD_OUT') {
        setNotice('That sale is sold out.');
      } else {
        setNotice(`Reservation request returned ${result.status}.`);
      }
    } catch {
      setNotice('Unable to reserve stock right now.');
    } finally {
      setPendingSaleId(null);
    }
  }

  async function handleCheckout() {
    if (!session || !selectedReservation) {
      return;
    }

    setIsSubmittingCheckout(true);
    setNotice(null);

    try {
      const result = await checkoutReservationRequest(
        selectedReservation.reservationId,
        session.userToken,
        nextRequestId(),
        simulateFailure
      );

      setCheckoutResult(result);
      await refreshReservations(session.userToken);
    } catch {
      setNotice('Unable to run checkout right now.');
    } finally {
      setIsSubmittingCheckout(false);
    }
  }

  if (!session) {
    return (
      <DisplayNameGate
        displayName={draftDisplayName}
        isSubmitting={isCreatingSession}
        onDisplayNameChange={setDraftDisplayName}
        onSubmit={handleCreateSession}
      />
    );
  }

  return (
    <main style={shell}>
      <section style={hero}>
        <div>
          <p style={eyebrow}>Operator session</p>
          <h1 style={headline}>Welcome, {session.displayName}</h1>
          <p style={lede}>Browse active drops, track expiring holds, and push the mocked checkout path without leaving the page.</p>
        </div>
        <div style={heroMetaCard}>
          <span style={metaLabel}>User token</span>
          <span style={metaValue}>{session.userToken}</span>
        </div>
      </section>

      {notice ? <p style={noticeBanner}>{notice}</p> : null}
      {isLoadingDashboard ? <p style={loadingBanner}>Syncing sale board...</p> : null}

      <section style={grid}>
        <SaleList items={sales} pendingSaleId={pendingSaleId} onReserve={handleReserve} />
        <ReservationPanel
          items={reservations}
          selectedReservationId={selectedReservationId}
          onSelectReservation={setSelectedReservationId}
        />
        <CheckoutPanel
          reservation={selectedReservation}
          simulateFailure={simulateFailure}
          isSubmitting={isSubmittingCheckout}
          lastResult={checkoutResult}
          onToggleFailure={setSimulateFailure}
          onCheckout={handleCheckout}
        />
      </section>
    </main>
  );
}

function nextRequestId() {
  return globalThis.crypto?.randomUUID?.() ?? `req_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

const shell: React.CSSProperties = {
  minHeight: '100vh',
  padding: 'clamp(1rem, 3vw, 2rem)',
  background: 'linear-gradient(135deg, #f5e7d1 0%, #d9ecff 55%, #f7f5ef 100%)',
  fontFamily: 'Avenir Next, Trebuchet MS, sans-serif'
};

const hero: React.CSSProperties = {
  display: 'flex',
  gap: '1rem',
  justifyContent: 'space-between',
  alignItems: 'flex-end',
  marginBottom: '1.5rem',
  flexWrap: 'wrap'
};

const eyebrow: React.CSSProperties = {
  margin: 0,
  fontSize: '0.82rem',
  textTransform: 'uppercase',
  letterSpacing: '0.12em',
  color: '#8b5e34'
};

const headline: React.CSSProperties = {
  margin: '0.35rem 0 0.5rem',
  color: '#18242f',
  fontSize: 'clamp(2.4rem, 5vw, 4rem)'
};

const lede: React.CSSProperties = {
  margin: 0,
  maxWidth: '42rem',
  color: '#365166',
  lineHeight: 1.6
};

const heroMetaCard: React.CSSProperties = {
  display: 'grid',
  gap: '0.3rem',
  padding: '1rem 1.15rem',
  minWidth: '260px',
  borderRadius: '1rem',
  background: 'rgba(16, 42, 67, 0.92)',
  color: '#f8f4ec'
};

const metaLabel: React.CSSProperties = {
  fontSize: '0.82rem',
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: '#f0b15a'
};

const metaValue: React.CSSProperties = {
  fontSize: '0.92rem',
  overflowWrap: 'anywhere'
};

const noticeBanner: React.CSSProperties = {
  margin: '0 0 1rem',
  padding: '0.9rem 1rem',
  borderRadius: '1rem',
  background: 'rgba(255, 255, 255, 0.78)',
  color: '#18242f'
};

const loadingBanner: React.CSSProperties = {
  margin: '0 0 1rem',
  color: '#365166'
};

const grid: React.CSSProperties = {
  display: 'grid',
  gap: '1rem',
  gridTemplateColumns: 'minmax(0, 1.2fr) minmax(280px, 0.9fr)',
  alignItems: 'start'
};