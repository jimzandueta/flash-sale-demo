import type { CSSProperties } from 'react';
import { formatUsd, storefrontPrice } from '../storefrontPricing';
import type { PurchaseSummary } from '../types';

type Props = {
  purchase: PurchaseSummary;
  onClose: () => void;
};

export function PaymentConfirmationModal({ purchase, onClose }: Props) {
  const price = storefrontPrice(purchase.itemName, purchase.price);

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="payment-confirmation-title" style={backdrop}>
      <div style={modal}>
        <span style={successPill}>Payment confirmed</span>

        <div style={modalHead}>
          <h2 id="payment-confirmation-title" style={modalTitle}>
            Payment confirmed.
          </h2>
          <p style={modalCopy}>This item has been paid successfully. Close to return to checkout.</p>
        </div>

        <div style={itemCard}>
          <div style={inlineRow}>
            <span style={itemNameStyle}>{purchase.itemName}</span>
            <span style={itemPriceStyle}>{price === null ? 'Price unavailable' : formatUsd(price)}</span>
          </div>
          <div style={inlineRow}>
            <span style={saleWindowPill}>{purchase.saleId}</span>
            <span style={mutedText}>Payment ID `{purchase.reservationId}`</span>
          </div>
        </div>

        <div style={summaryGrid}>
          <div style={summaryCard}>
            <span style={summaryLabel}>Paid at</span>
            <span style={summaryValue}>{formatDateTime(purchase.purchasedAt)}</span>
          </div>
          <div style={summaryCard}>
            <span style={summaryLabel}>Status</span>
            <span style={summaryValue}>Successful</span>
          </div>
        </div>

        <div style={modalActions}>
          <button style={closeButton} onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });
}

const backdrop: CSSProperties = {
  position: 'fixed',
  inset: 0,
  display: 'grid',
  placeItems: 'center',
  background: 'rgba(15,23,42,.32)',
  padding: '24px',
  zIndex: 20
};

const modal: CSSProperties = {
  width: 'min(100%, 560px)',
  display: 'grid',
  gap: '16px',
  padding: '24px',
  borderRadius: '24px',
  background: '#fff',
  border: '1px solid rgba(95,111,255,.18)',
  boxShadow: '0 24px 80px rgba(15,23,42,.22)'
};

const successPill: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 'max-content',
  minHeight: '30px',
  padding: '0 12px',
  borderRadius: '999px',
  background: '#dcfce7',
  color: '#166534',
  fontSize: '11px',
  fontWeight: 700,
  letterSpacing: '.08em',
  textTransform: 'uppercase'
};

const modalHead: CSSProperties = {
  display: 'grid',
  gap: '8px'
};

const modalTitle: CSSProperties = {
  margin: 0,
  fontSize: '30px',
  lineHeight: 0.98,
  color: '#101828'
};

const modalCopy: CSSProperties = {
  margin: 0,
  fontSize: '15px',
  lineHeight: 1.5,
  color: '#667085'
};

const itemCard: CSSProperties = {
  display: 'grid',
  gap: '10px',
  padding: '16px',
  borderRadius: '18px',
  background: '#f8faff',
  border: '1px solid rgba(95,111,255,.10)'
};

const inlineRow: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: '12px',
  flexWrap: 'wrap'
};

const itemNameStyle: CSSProperties = {
  fontSize: '20px',
  fontWeight: 700,
  color: '#101828'
};

const itemPriceStyle: CSSProperties = {
  fontSize: '22px',
  fontWeight: 800,
  color: '#101828',
  textAlign: 'right',
  whiteSpace: 'nowrap'
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

const mutedText: CSSProperties = {
  fontSize: '12px',
  color: '#667085'
};

const summaryGrid: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: '12px'
};

const summaryCard: CSSProperties = {
  display: 'grid',
  gap: '6px',
  padding: '14px',
  borderRadius: '16px',
  background: '#fff',
  border: '1px solid rgba(95,111,255,.12)'
};

const summaryLabel: CSSProperties = {
  fontSize: '11px',
  fontWeight: 700,
  letterSpacing: '.08em',
  textTransform: 'uppercase',
  color: '#667085'
};

const summaryValue: CSSProperties = {
  fontSize: '16px',
  fontWeight: 700,
  color: '#101828'
};

const modalActions: CSSProperties = {
  display: 'flex',
  justifyContent: 'flex-end',
  gap: '10px',
  flexWrap: 'wrap'
};

const closeButton: CSSProperties = {
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
