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
        <h2 id="payment-confirmation-title" style={title}>
          Payment confirmed.
        </h2>

        <div style={summaryCard}>
          <p style={itemName}>{purchase.itemName}</p>
          <p style={itemMeta}>{price === null ? 'Price unavailable' : formatUsd(price)}</p>
          <p style={itemMeta}>Reservation {purchase.reservationId}</p>
          <p style={itemMeta}>Paid at {formatDateTime(purchase.purchasedAt)}</p>
        </div>

        <div style={actions}>
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
  padding: '1rem',
  background: 'rgba(11,25,45,0.45)',
  zIndex: 20
};

const modal: CSSProperties = {
  width: 'min(100%, 28rem)',
  display: 'grid',
  gap: '0.9rem',
  padding: '1rem',
  borderRadius: '1rem',
  background: '#ffffff',
  border: '1px solid #bbf7d0',
  boxShadow: '0 24px 48px rgba(11,25,45,0.22)'
};

const title: CSSProperties = {
  margin: 0,
  fontSize: '1.2rem',
  fontWeight: 700,
  color: '#166534'
};

const summaryCard: CSSProperties = {
  display: 'grid',
  gap: '0.25rem',
  padding: '0.85rem',
  borderRadius: '0.85rem',
  background: '#f0fdf4',
  border: '1px solid #bbf7d0'
};

const itemName: CSSProperties = { margin: 0, fontSize: '1rem', fontWeight: 700, color: '#0b192d' };
const itemMeta: CSSProperties = { margin: 0, fontSize: '0.82rem', color: '#166534' };

const actions: CSSProperties = {
  display: 'flex',
  justifyContent: 'flex-end'
};

const closeButton: CSSProperties = {
  border: 'none',
  borderRadius: '0.55rem',
  padding: '0.7rem 1rem',
  background: '#16a34a',
  color: '#ffffff',
  fontWeight: 700,
  cursor: 'pointer'
};
