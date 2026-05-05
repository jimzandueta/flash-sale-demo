import type { CSSProperties } from 'react';
import type { SessionResponse } from '../api/client';
import { PageShell } from '../components/PageShell';
import type { CartReservation, Notice, PurchaseSummary } from '../types';

type Props = {
  session: SessionResponse | null;
  notice: Notice | null;
  cart: CartReservation[];
  purchases: PurchaseSummary[];
  now: number;
  isCheckingOutIds: Set<string>;
  isCancellingIds: Set<string>;
  simulateFailureIds: Set<string>;
  onBuyItem: (reservationId: string) => void;
  onRemoveFromCart: (reservationId: string) => void;
  onToggleSimulateFailure: (reservationId: string) => void;
  onViewConfirmation: () => void;
  onKeepShopping: () => void;
};

export function CheckoutPage({
  session,
  notice,
  cart,
  purchases,
  now,
  isCheckingOutIds,
  isCancellingIds,
  simulateFailureIds,
  onBuyItem,
  onRemoveFromCart,
  onToggleSimulateFailure,
  onViewConfirmation,
  onKeepShopping
}: Props) {
  const sortedCart = [...cart].sort((a, b) => Date.parse(a.expiresAt) - Date.parse(b.expiresAt));
  const allDone = cart.length === 0 && purchases.length > 0;

  return (
    <PageShell
      page="checkout"
      title="Checkout"
      description="Pay for each held item. The most urgent hold is shown first."
      session={session}
      notice={notice}
    >
      {purchases.map((purchase) => (
        <div key={purchase.reservationId} style={purchasedCard}>
          <p style={eyebrowSuccess}>✓ Purchased</p>
          <div style={purchasedRow}>
            <span style={checkBadge}>✓</span>
            <div>
              <p style={itemName}>{purchase.itemName}</p>
              <p style={itemMeta}>Paid at {formatDateTime(purchase.purchasedAt)}</p>
              <p style={reservationIdText}>{purchase.reservationId}</p>
            </div>
          </div>
        </div>
      ))}

      {sortedCart.map((item, index) => {
        const msRemaining = Date.parse(item.expiresAt) - now;
        const isUrgent = msRemaining > 0 && msRemaining < 60_000;
        const isBuying = isCheckingOutIds.has(item.reservationId);
        const isCancelling = isCancellingIds.has(item.reservationId);
        const simFailure = simulateFailureIds.has(item.reservationId);

        return (
          <div key={item.reservationId} style={isUrgent ? urgentCard : normalCard}>
            <p style={isUrgent ? eyebrowUrgent : eyebrow}>
              {isUrgent ? '⚡ Expires soonest — pay this first' : index === 0 ? 'Pay next' : 'Up next'}
            </p>
            <p style={cardTitle}>{item.itemName}</p>

            <div style={metaRow}>
              <span style={metaText}>{item.reservationId}</span>
              <span style={isUrgent ? timerUrgent : timerNormal}>
                {formatRemaining(item.expiresAt, now)}
              </span>
            </div>

            {isUrgent ? (
              <p style={urgentWarning}>⚠ Less than 1 minute — this hold will expire soon</p>
            ) : null}

            <label style={simulateRow}>
              <input
                type="checkbox"
                checked={simFailure}
                onChange={() => onToggleSimulateFailure(item.reservationId)}
                disabled={isBuying}
              />
              Simulate payment failure
            </label>

            <button
              style={isUrgent ? buyUrgentBtn : buyNormalBtn}
              disabled={isBuying || isCancelling}
              onClick={() => onBuyItem(item.reservationId)}
            >
              {isBuying ? 'Processing...' : `Buy ${item.itemName} →`}
            </button>

            <div style={{ marginTop: '0.45rem', textAlign: 'right' }}>
              <button
                style={isUrgent ? removeUrgentBtn : removeBtn}
                disabled={isBuying || isCancelling}
                onClick={() => onRemoveFromCart(item.reservationId)}
              >
                {isCancelling ? 'Removing...' : 'Remove from cart'}
              </button>
            </div>
          </div>
        );
      })}

      {allDone ? (
        <div style={allDoneCard}>
          <button style={confirmationBtn} onClick={onViewConfirmation}>
            View order confirmation →
          </button>
        </div>
      ) : null}

      <div style={footerRow}>
        <button style={ghostBtn} onClick={onKeepShopping}>← Keep shopping</button>
      </div>
    </PageShell>
  );
}

function formatRemaining(expiresAt: string, now: number) {
  const ms = Date.parse(expiresAt) - now;
  if (ms <= 0) return '0:00';
  const seconds = Math.floor(ms / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });
}

const purchasedCard: CSSProperties = {
  background: '#f0fdf4',
  border: '1px solid #bbf7d0',
  borderRadius: '0.875rem',
  padding: '1rem'
};

const eyebrowSuccess: CSSProperties = {
  margin: '0 0 0.4rem',
  fontSize: '0.7rem',
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
  color: '#166534',
  fontWeight: 700
};

const purchasedRow: CSSProperties = { display: 'flex', alignItems: 'center', gap: '0.6rem' };

const checkBadge: CSSProperties = {
  width: '1.3rem',
  height: '1.3rem',
  background: '#dcfce7',
  borderRadius: '999px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: '0.72rem',
  color: '#166534',
  flexShrink: 0
};

const itemName: CSSProperties = { margin: 0, fontWeight: 700, fontSize: '0.9rem', color: '#0b192d' };
const itemMeta: CSSProperties = { margin: '0.1rem 0 0', fontSize: '0.74rem', color: '#6b7280' };
const reservationIdText: CSSProperties = { margin: '0.1rem 0 0', fontSize: '0.74rem', color: '#6b7280' };

const normalCard: CSSProperties = {
  background: '#ffffff',
  border: '1px solid #e5e7eb',
  borderRadius: '0.875rem',
  padding: '1rem',
  boxShadow: '0 1px 6px rgba(9,90,233,0.06)'
};

const urgentCard: CSSProperties = {
  background: '#fff8f8',
  border: '2px solid #c0392b',
  borderRadius: '0.875rem',
  padding: '1rem',
  boxShadow: '0 4px 18px rgba(192,57,43,0.15)'
};

const eyebrow: CSSProperties = {
  margin: '0 0 0.2rem',
  fontSize: '0.7rem',
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
  color: '#095ae9',
  fontWeight: 700
};

const eyebrowUrgent: CSSProperties = {
  ...eyebrow,
  color: '#c0392b'
};

const cardTitle: CSSProperties = {
  margin: '0 0 0.5rem',
  fontSize: '1rem',
  fontWeight: 700,
  color: '#0b192d'
};

const metaRow: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  marginBottom: '0.55rem'
};

const metaText: CSSProperties = { fontSize: '0.72rem', color: '#6b7280' };

const timerNormal: CSSProperties = {
  fontSize: '0.88rem',
  fontWeight: 700,
  color: '#095ae9',
  background: '#e0f0ff',
  padding: '0.22rem 0.65rem',
  borderRadius: '999px'
};

const timerUrgent: CSSProperties = {
  ...timerNormal,
  color: '#ffffff',
  background: '#c0392b'
};

const urgentWarning: CSSProperties = {
  margin: '0 0 0.6rem',
  background: 'rgba(192,57,43,0.07)',
  border: '1px solid rgba(192,57,43,0.18)',
  borderRadius: '0.5rem',
  padding: '0.4rem 0.65rem',
  fontSize: '0.78rem',
  color: '#c0392b'
};

const simulateRow: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.5rem',
  fontSize: '0.78rem',
  color: '#6b7280',
  marginBottom: '0.6rem'
};

const buyNormalBtn: CSSProperties = {
  background: '#095ae9',
  color: '#ffffff',
  border: 'none',
  borderRadius: '0.5rem',
  padding: '0.55rem 0.9rem',
  fontSize: '0.82rem',
  fontWeight: 700,
  cursor: 'pointer',
  width: '100%'
};

const buyUrgentBtn: CSSProperties = {
  ...buyNormalBtn,
  background: '#c0392b',
  boxShadow: '0 2px 10px rgba(192,57,43,0.25)'
};

const removeBtn: CSSProperties = {
  border: '1px solid #e5e7eb',
  background: 'transparent',
  color: '#6b7280',
  borderRadius: '0.4rem',
  padding: '0.24rem 0.55rem',
  fontSize: '0.75rem',
  fontWeight: 600,
  cursor: 'pointer'
};

const removeUrgentBtn: CSSProperties = {
  ...removeBtn,
  border: '1px solid rgba(192,57,43,0.35)',
  color: '#c0392b'
};

const allDoneCard: CSSProperties = {
  background: '#f0fdf4',
  border: '1px solid #bbf7d0',
  borderRadius: '0.875rem',
  padding: '1rem'
};

const confirmationBtn: CSSProperties = {
  background: '#095ae9',
  color: '#ffffff',
  border: 'none',
  borderRadius: '0.5rem',
  padding: '0.65rem 1rem',
  fontSize: '0.88rem',
  fontWeight: 700,
  cursor: 'pointer',
  width: '100%',
  textAlign: 'center'
};

const footerRow: CSSProperties = { display: 'flex', gap: '0.5rem' };

const ghostBtn: CSSProperties = {
  background: '#ffffff',
  border: '1px solid #e5e7eb',
  color: '#374151',
  borderRadius: '0.5rem',
  padding: '0.45rem 0.8rem',
  fontSize: '0.82rem',
  fontWeight: 600,
  cursor: 'pointer'
};
