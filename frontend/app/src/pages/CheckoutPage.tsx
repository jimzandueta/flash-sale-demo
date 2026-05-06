import { useEffect, useState, type CSSProperties } from 'react';
import type { SaleItem, SessionResponse } from '../api/client';
import { PageShell } from '../components/PageShell';
import { PaymentConfirmationModal } from '../components/PaymentConfirmationModal';
import { PaymentModal } from '../components/PaymentModal';
import { formatUsd, storefrontPrice } from '../storefrontPricing';
import type { CartReservation, Notice, PurchaseSummary } from '../types';

type Props = {
  session: SessionResponse | null;
  notice: Notice | null;
  sales: SaleItem[];
  cart: CartReservation[];
  purchases: PurchaseSummary[];
  now: number;
  isCheckingOutIds: Set<string>;
  isCancellingIds: Set<string>;
  simulateFailureIds: Set<string>;
  activePaymentItem: CartReservation | null;
  paymentConfirmationPurchase: PurchaseSummary | null;
  paymentError: string | null;
  onOpenPayment: (reservationId: string) => void;
  onClosePayment: () => void;
  onConfirmPayment: () => void;
  onClosePaymentConfirmation: () => void;
  onRemoveFromCart: (reservationId: string) => void;
  onToggleSimulateFailure: (reservationId: string) => void;
  onKeepShopping: () => void;
};

export function CheckoutPage({
  session,
  notice,
  sales,
  cart,
  purchases,
  now,
  isCheckingOutIds,
  isCancellingIds,
  simulateFailureIds,
  activePaymentItem,
  paymentConfirmationPurchase,
  paymentError,
  onOpenPayment,
  onClosePayment,
  onConfirmPayment,
  onClosePaymentConfirmation,
  onRemoveFromCart,
  onToggleSimulateFailure,
  onKeepShopping
}: Props) {
  const [selectedPurchase, setSelectedPurchase] = useState<PurchaseSummary | null>(null);
  const salesById = new Map(sales.map((sale) => [sale.saleId, sale]));
  const rows = [
    ...purchases.map((purchase) => ({ kind: 'purchase' as const, sortAt: purchase.expiresAt, purchase })),
    ...cart.map((item) => ({ kind: 'cart' as const, sortAt: item.expiresAt, item }))
  ].sort((a, b) => Date.parse(a.sortAt) - Date.parse(b.sortAt));
  const visiblePaymentConfirmationPurchase = selectedPurchase ?? paymentConfirmationPurchase;

  useEffect(() => {
    if (paymentConfirmationPurchase) {
      setSelectedPurchase(paymentConfirmationPurchase);
    }
  }, [paymentConfirmationPurchase]);

  return (
    <PageShell
      page="checkout"
      title="Review your cart"
      session={session}
      notice={notice}
    >
      {rows.map((row, index) => {
        if (row.kind === 'purchase') {
          const price = formatPrice(row.purchase.itemName, row.purchase.price);

          return (
            <article key={row.purchase.reservationId} style={purchasedCard}>
              <div style={topRow}>
                <p style={eyebrowSuccess}>✓ Purchased</p>
                <span style={timerPurchased}>Paid at {formatDateTime(row.purchase.purchasedAt)}</span>
              </div>

              <div style={mainRow}>
                <div aria-hidden="true" style={imagePlaceholder}>
                  {imageLabel(row.purchase.itemName)}
                </div>
                <div style={itemInfo}>
                  <div style={namePriceRow}>
                    <p style={itemName}>{row.purchase.itemName}</p>
                    <p style={itemPrice}>{price}</p>
                  </div>
                  <p style={reservationIdText}>{row.purchase.reservationId}</p>
                </div>
              </div>

              <div style={bottomRow}>
                <span style={windowText}>{formatSaleWindow(salesById.get(row.purchase.saleId))}</span>
                <button style={confirmationBtn} onClick={() => setSelectedPurchase(row.purchase)}>
                  Show payment confirmation
                </button>
              </div>
            </article>
          );
        }

        const item = row.item;
        const price = formatPrice(item.itemName, item.price);
        const msRemaining = Date.parse(item.expiresAt) - now;
        const isUrgent = msRemaining > 0 && msRemaining < 60_000;
        const isBuying = isCheckingOutIds.has(item.reservationId);
        const isCancelling = isCancellingIds.has(item.reservationId);
        const activeIndex = rows.slice(0, index).filter((entry) => entry.kind === 'cart').length;

        return (
          <article key={item.reservationId} style={isUrgent ? urgentCard : normalCard}>
            <div style={topRow}>
              <p style={isUrgent ? eyebrowUrgent : eyebrow}>
                {isUrgent ? '⚡ Expires soonest - pay this first' : activeIndex === 0 ? 'Pay next' : 'Up next'}
              </p>
              <span style={isUrgent ? timerUrgent : timerNormal}>
                {formatRemaining(item.expiresAt, now)}
              </span>
            </div>

            <div style={mainRow}>
              <div aria-hidden="true" style={imagePlaceholder}>
                {imageLabel(item.itemName)}
              </div>
              <div style={itemInfo}>
                <div style={namePriceRow}>
                  <p style={cardTitle}>{item.itemName}</p>
                  <p style={itemPrice}>{price}</p>
                </div>
                <p style={metaText}>{item.reservationId}</p>
              </div>
            </div>

            {isUrgent ? (
              <p style={urgentWarning}>⚠ Less than 1 minute — this hold will expire soon</p>
            ) : null}

            <div style={bottomRow}>
              <span style={windowText}>{formatSaleWindow(salesById.get(item.saleId))}</span>
              <div style={actionsRow}>
                <button
                  style={isUrgent ? removeUrgentBtn : removeBtn}
                  disabled={isBuying || isCancelling}
                  onClick={() => onRemoveFromCart(item.reservationId)}
                >
                  {isCancelling ? 'Removing...' : 'Remove from cart'}
                </button>
                <button
                  style={isUrgent ? buyUrgentBtn : buyNormalBtn}
                  disabled={isBuying || isCancelling}
                  onClick={() => onOpenPayment(item.reservationId)}
                >
                  {isBuying ? 'Processing...' : 'Pay now'}
                </button>
              </div>
            </div>
          </article>
        );
      })}

      <div style={footerRow}>
        <button style={ghostBtn} onClick={onKeepShopping}>← Keep shopping</button>
      </div>

      {activePaymentItem ? (
        <PaymentModal
          item={activePaymentItem}
          shopperName={session?.displayName ?? ''}
          now={now}
          isSubmitting={isCheckingOutIds.has(activePaymentItem.reservationId)}
          isSimulatingFailure={simulateFailureIds.has(activePaymentItem.reservationId)}
          error={paymentError}
          onToggleSimulateFailure={() => onToggleSimulateFailure(activePaymentItem.reservationId)}
          onCancel={onClosePayment}
          onConfirm={onConfirmPayment}
        />
      ) : null}

      {visiblePaymentConfirmationPurchase ? (
        <PaymentConfirmationModal
          purchase={visiblePaymentConfirmationPurchase}
          onClose={() => {
            setSelectedPurchase(null);
            onClosePaymentConfirmation();
          }}
        />
      ) : null}
    </PageShell>
  );
}

function formatPrice(itemName: string, price?: number) {
  const resolved = storefrontPrice(itemName, price);
  return resolved === null ? 'Price unavailable' : formatUsd(resolved);
}

function imageLabel(itemName: string) {
  return itemName
    .split(' ')
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
}

function formatSaleWindow(sale: SaleItem | undefined) {
  if (!sale) return 'Sale window unavailable';
  return formatWindow(sale.startsAt, sale.endsAt);
}

function formatWindow(startsAt: string, endsAt: string) {
  const fmt = (value: string) => new Date(value).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  return `${fmt(startsAt)} - ${fmt(endsAt)}`;
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
  background: '#f8fafc',
  border: '1px solid #dbe5f0',
  borderRadius: '0.875rem',
  padding: '1rem',
  display: 'grid',
  gap: '0.8rem'
};

const eyebrowSuccess: CSSProperties = {
  margin: '0 0 0.4rem',
  fontSize: '0.7rem',
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
  color: '#4b5563',
  fontWeight: 700
};

const topRow: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '0.75rem',
  flexWrap: 'wrap'
};

const mainRow: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '3.25rem minmax(0, 1fr)',
  gap: '0.8rem',
  alignItems: 'center'
};

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

const imagePlaceholder: CSSProperties = {
  display: 'grid',
  placeItems: 'center',
  width: '3.25rem',
  height: '3.25rem',
  borderRadius: '0.8rem',
  background: '#eff3f8',
  color: '#6b7280',
  fontSize: '0.75rem',
  fontWeight: 700,
  letterSpacing: '0.08em'
};

const itemInfo: CSSProperties = {
  display: 'grid',
  gap: '0.2rem',
  minWidth: 0
};

const namePriceRow: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '0.75rem'
};

const itemName: CSSProperties = { margin: 0, fontWeight: 700, fontSize: '0.9rem', color: '#0b192d' };
const itemPrice: CSSProperties = { margin: 0, color: '#095ae9', fontSize: '0.92rem', fontWeight: 700, flexShrink: 0 };
const reservationIdText: CSSProperties = { margin: '0.1rem 0 0', fontSize: '0.74rem', color: '#6b7280' };

const normalCard: CSSProperties = {
  background: '#ffffff',
  border: '1px solid #e5e7eb',
  borderRadius: '0.875rem',
  padding: '1rem',
  boxShadow: '0 1px 6px rgba(9,90,233,0.06)',
  display: 'grid',
  gap: '0.8rem'
};

const urgentCard: CSSProperties = {
  background: '#fff8f8',
  border: '2px solid #c0392b',
  borderRadius: '0.875rem',
  padding: '1rem',
  boxShadow: '0 4px 18px rgba(192,57,43,0.15)',
  display: 'grid',
  gap: '0.8rem'
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
  margin: 0,
  fontSize: '1rem',
  fontWeight: 700,
  color: '#0b192d'
};

const bottomRow: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '0.75rem',
  flexWrap: 'wrap'
};

const metaText: CSSProperties = { margin: 0, fontSize: '0.72rem', color: '#6b7280' };

const windowText: CSSProperties = { fontSize: '0.78rem', color: '#4b5563' };

const actionsRow: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.55rem',
  marginLeft: 'auto',
  flexWrap: 'wrap',
  justifyContent: 'flex-end'
};

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

const timerPurchased: CSSProperties = {
  fontSize: '0.74rem',
  fontWeight: 600,
  color: '#6b7280',
  background: '#eef2f7',
  padding: '0.22rem 0.65rem',
  borderRadius: '999px'
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

const buyNormalBtn: CSSProperties = {
  background: '#095ae9',
  color: '#ffffff',
  border: 'none',
  borderRadius: '0.5rem',
  padding: '0.55rem 0.9rem',
  fontSize: '0.82rem',
  fontWeight: 700,
  cursor: 'pointer'
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

const confirmationBtn: CSSProperties = {
  background: '#ffffff',
  border: '1px solid #d1d9e6',
  color: '#374151',
  borderRadius: '0.5rem',
  padding: '0.5rem 0.85rem',
  fontSize: '0.8rem',
  fontWeight: 600,
  cursor: 'pointer',
  marginLeft: 'auto'
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
