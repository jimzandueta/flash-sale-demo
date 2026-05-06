import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import type { SaleItem, SessionResponse } from '../api/client';
import { PageShell } from '../components/PageShell';
import { PaymentConfirmationModal } from '../components/PaymentConfirmationModal';
import { PaymentModal } from '../components/PaymentModal';
import { formatUsd, storefrontPrice } from '../storefrontPricing';
import { storefrontMeta } from '../storefrontCatalog';
import { formatDateTime, formatRemaining, formatWindow } from '../dateUtils';
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
  dock?: ReactNode;
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
  dock,
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
  const activeCart = cart.filter((item) => item.state !== 'expired' && Date.parse(item.expiresAt) > now);
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
      header={{
        eyebrow: 'KooPiBi / Flash Sale / Checkout',
        headline: 'Checkout',
        supportingCopy: 'Pay held items one at a time before their timers expire.'
      }}
      notice={notice}
      dock={dock}
    >
      <div style={checkoutLayout}>
        <div style={queueCard}>
          <div style={queueList}>
            {rows.map((row, index) => {
              if (row.kind === 'purchase') {
                const price = formatPrice(row.purchase.itemName, row.purchase.price);

                return (
                  <article key={row.purchase.reservationId} style={queueItemPurchased}>
                    <div style={queueHead}>
                      <p style={queueEyebrowPurchased}>Purchased</p>
                      <span style={mutedText}>Paid {formatDateTime(row.purchase.purchasedAt)}</span>
                    </div>
                    <div style={queueMain}>
                      <div aria-hidden="true" style={{ ...queueArt, background: storefrontMeta(row.purchase.itemName).gradient }} />
                      <div style={queueCopy}>
                        <strong style={queueName}>{row.purchase.itemName}</strong>
                        <p style={queueNote}>Payment completed successfully.</p>
                      </div>
                      <span style={queuePrice}>{price}</span>
                    </div>
                    <div style={queueActions}>
                      <span style={saleWindowPill}>{formatSaleWindow(salesById.get(row.purchase.saleId))}</span>
                      <div style={queueActionButtons}>
                        <button style={btnSecondary} onClick={() => setSelectedPurchase(row.purchase)}>
                          Show payment confirmation
                        </button>
                      </div>
                    </div>
                  </article>
                );
              }

              const item = row.item;
              const price = formatPrice(item.itemName, item.price);
              const msRemaining = Date.parse(item.expiresAt) - now;
              const isExpired = item.state === 'expired' || msRemaining <= 0;
              const isUrgent = msRemaining > 0 && msRemaining < 60_000;
              const isBuying = isCheckingOutIds.has(item.reservationId);
              const isCancelling = isCancellingIds.has(item.reservationId);
              const activeIndex = rows.slice(0, index).filter((entry) => entry.kind === 'cart' && entry.item.state !== 'expired').length;

              return (
                <article key={item.reservationId} style={isUrgent ? queueItemUrgent : queueItem}>
                  <div style={queueHead}>
                    <p style={isUrgent ? queueEyebrowUrgent : queueEyebrow}>
                      {isUrgent ? 'Expires soonest' : activeIndex === 0 ? 'Up next' : 'Up next'}
                    </p>
                    <span style={isUrgent ? timerPillUrgent : timerPill}>
                      {isExpired ? 'Expired' : formatRemaining(item.expiresAt, now)}
                    </span>
                  </div>
                  <div style={queueMain}>
                    <div aria-hidden="true" style={{ ...queueArt, background: storefrontMeta(item.itemName).gradient }} />
                    <div style={queueCopy}>
                      <strong style={queueName}>{item.itemName}</strong>
                      <p style={queueNote}>
                        {isUrgent ? 'Pay this hold first to avoid losing the item.' : 'Held and ready once the first payment is complete.'}
                      </p>
                    </div>
                    <span style={queuePrice}>{price}</span>
                  </div>
                  <div style={queueActions}>
                    <span style={saleWindowPill}>{formatSaleWindow(salesById.get(item.saleId))}</span>
                    <div style={queueActionButtons}>
                      <button style={linkBtn} disabled={isBuying || isCancelling} onClick={() => onRemoveFromCart(item.reservationId)}>
                        {isCancelling ? 'Removing...' : 'Remove from cart'}
                      </button>
                      {isExpired ? null : (
                        <button style={isUrgent ? btnUrgent : btnPrimary} disabled={isBuying || isCancelling} onClick={() => onOpenPayment(item.reservationId)}>
                          {isBuying ? 'Processing...' : 'Pay now'}
                        </button>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>

          <button style={btnSecondary} onClick={onKeepShopping}>
            Back to products
          </button>
        </div>
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

const checkoutLayout: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr)',
  gap: '18px',
  alignItems: 'start'
};

const queueCard: CSSProperties = {
  display: 'grid',
  gap: '14px',
  padding: '20px',
  borderRadius: '22px',
  border: '1px solid rgba(95,111,255,.14)',
  boxShadow: '0 18px 36px rgba(95,111,255,.08)',
  background: 'linear-gradient(180deg,#ffffff 0%,#f8faff 100%)'
};

const queueList: CSSProperties = {
  display: 'grid',
  gap: '12px'
};

const queueItem: CSSProperties = {
  display: 'grid',
  gap: '10px',
  padding: '16px',
  borderRadius: '18px',
  background: '#fff',
  border: '1px solid rgba(95,111,255,.12)',
  boxShadow: '0 12px 26px rgba(15,23,42,.05)'
};

const queueItemUrgent: CSSProperties = {
  ...queueItem,
  background: 'linear-gradient(180deg,#ffebee 0%,#ffffff 100%)',
  border: '2px solid #ef5350',
  boxShadow: '0 14px 30px rgba(239,83,80,.12)'
};

const queueItemPurchased: CSSProperties = {
  ...queueItem,
  background: '#f3faf5',
  border: '1px solid #b7e4c7',
  boxShadow: 'none'
};

const queueHead: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: '12px',
  flexWrap: 'wrap'
};

const queueMain: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '56px minmax(0,1fr) auto',
  gap: '14px',
  alignItems: 'center'
};

const queueArt: CSSProperties = {
  width: '56px',
  aspectRatio: '1/1',
  borderRadius: '16px',
  border: '1px solid rgba(15,23,42,.08)'
};

const queueCopy: CSSProperties = {
  display: 'grid',
  gap: '6px'
};

const queueName: CSSProperties = {
  fontSize: '20px',
  fontWeight: 700,
  color: '#101828'
};

const queueNote: CSSProperties = {
  margin: 0,
  fontSize: '13px',
  lineHeight: 1.45,
  color: '#667085'
};

const queuePrice: CSSProperties = {
  fontSize: '22px',
  fontWeight: 800,
  color: '#101828',
  textAlign: 'right',
  whiteSpace: 'nowrap'
};

const queueActions: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: '12px',
  flexWrap: 'wrap'
};

const queueActionButtons: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '10px',
  flexWrap: 'wrap'
};

const timerPill: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: '28px',
  padding: '0 12px',
  borderRadius: '999px',
  background: '#eef2ff',
  color: '#4f46e5',
  fontSize: '11px',
  fontWeight: 700,
  letterSpacing: '.08em',
  textTransform: 'uppercase'
};

const timerPillUrgent: CSSProperties = {
  ...timerPill,
  background: '#d32f2f',
  color: '#fff'
};

const saleWindowPill: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: '28px',
  padding: '0 12px',
  borderRadius: '999px',
  background: '#f8fafc',
  color: '#475467',
  fontSize: '11px',
  fontWeight: 700,
  letterSpacing: '.08em',
  textTransform: 'uppercase',
  border: '1px solid rgba(15,23,42,.08)'
};

const queueEyebrow: CSSProperties = {
  margin: 0,
  fontSize: '11px',
  fontWeight: 700,
  letterSpacing: '.1em',
  textTransform: 'uppercase',
  color: '#5f6fff'
};

const queueEyebrowUrgent: CSSProperties = {
  ...queueEyebrow,
  color: '#d32f2f'
};

const queueEyebrowPurchased: CSSProperties = {
  ...queueEyebrow,
  color: '#15803d'
};

const mutedText: CSSProperties = {
  fontSize: '12px',
  color: '#667085'
};

const btnPrimary: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: '12px',
  padding: '10px 14px',
  fontWeight: 700,
  fontSize: '13px',
  border: '1px solid transparent',
  background: '#5f6fff',
  color: '#fff',
  cursor: 'pointer'
};

const btnUrgent: CSSProperties = {
  ...btnPrimary,
  background: '#d32f2f',
  borderColor: '#d32f2f'
};

const btnSuccess: CSSProperties = {
  ...btnPrimary,
  background: '#16a34a',
  borderColor: '#16a34a'
};

const btnSecondary: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: '12px',
  padding: '10px 14px',
  fontWeight: 700,
  fontSize: '13px',
  border: '1px solid #c7d2fe',
  background: '#fff',
  color: '#5f6fff',
  cursor: 'pointer'
};

const linkBtn: CSSProperties = {
  fontSize: '12px',
  fontWeight: 700,
  color: '#667085',
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  padding: 0
};
