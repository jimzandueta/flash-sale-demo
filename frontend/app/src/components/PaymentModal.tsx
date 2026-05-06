import type { CSSProperties } from 'react';
import { formatUsd, storefrontPrice } from '../storefrontPricing';
import type { CartReservation } from '../types';

type Props = {
  item: CartReservation;
  shopperName: string;
  now: number;
  isSubmitting: boolean;
  isSimulatingFailure: boolean;
  error: string | null;
  onToggleSimulateFailure: () => void;
  onCancel: () => void;
  onConfirm: () => void;
};

export function PaymentModal({
  item,
  shopperName,
  now,
  isSubmitting,
  isSimulatingFailure,
  error,
  onToggleSimulateFailure,
  onCancel,
  onConfirm
}: Props) {
  const price = storefrontPrice(item.itemName, item.price);

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="payment-modal-title" style={backdrop}>
      <div style={modal}>
        <div style={headerRow}>
          <h2 id="payment-modal-title" style={title}>
            {`Pay for ${item.itemName}`}
          </h2>
          <span style={timer}>{formatRemaining(item.expiresAt, now)}</span>
        </div>

        <div style={summaryCard}>
          <p style={summaryName}>{item.itemName}</p>
          <p style={summaryMeta}>Reservation {item.reservationId}</p>
          <p style={summaryPrice}>{price === null ? 'Price unavailable' : formatUsd(price)}</p>
        </div>

        <div style={fieldGrid}>
          <div style={fieldCard}>
            <span style={fieldLabel}>Card number</span>
            <strong style={fieldValue}>**** **** **** 4242</strong>
          </div>
          <div style={fieldCard}>
            <span style={fieldLabel}>Expiry</span>
            <strong style={fieldValue}>08/29</strong>
          </div>
          <div style={fieldCard}>
            <span style={fieldLabel}>CVV</span>
            <strong style={fieldValue}>****</strong>
          </div>
          <div style={fieldCard}>
            <span style={fieldLabel}>Name</span>
            <strong style={fieldValue}>{shopperName}</strong>
          </div>
        </div>

        <label style={toggleRow}>
          <input
            type="checkbox"
            checked={isSimulatingFailure}
            onChange={onToggleSimulateFailure}
            disabled={isSubmitting}
          />
          Simulate payment failure
        </label>

        {error ? <p style={errorText}>{error}</p> : null}

        <div style={actions}>
          <button style={cancelButton} disabled={isSubmitting} onClick={onCancel}>
            Cancel
          </button>
          <button style={confirmButton} disabled={isSubmitting} onClick={onConfirm}>
            {isSubmitting ? 'Processing...' : 'Confirm payment'}
          </button>
        </div>
      </div>
    </div>
  );
}

function formatRemaining(expiresAt: string, now: number) {
  const ms = Date.parse(expiresAt) - now;
  if (ms <= 0) return '0:00';
  const seconds = Math.floor(ms / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
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
  width: 'min(100%, 32rem)',
  display: 'grid',
  gap: '0.9rem',
  padding: '1rem',
  borderRadius: '1rem',
  background: '#ffffff',
  border: '1px solid rgba(9,90,233,0.12)',
  boxShadow: '0 24px 48px rgba(11,25,45,0.22)'
};

const headerRow: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '0.75rem'
};

const title: CSSProperties = {
  margin: 0,
  fontSize: '1.2rem',
  fontWeight: 700,
  color: '#0b192d'
};

const timer: CSSProperties = {
  padding: '0.28rem 0.7rem',
  borderRadius: '999px',
  background: '#e0f0ff',
  color: '#095ae9',
  fontSize: '0.82rem',
  fontWeight: 700
};

const summaryCard: CSSProperties = {
  display: 'grid',
  gap: '0.25rem',
  padding: '0.85rem',
  borderRadius: '0.85rem',
  background: '#f8fbff',
  border: '1px solid rgba(9,90,233,0.1)'
};

const summaryName: CSSProperties = { margin: 0, fontSize: '1rem', fontWeight: 700, color: '#0b192d' };
const summaryMeta: CSSProperties = { margin: 0, fontSize: '0.78rem', color: '#6b7280' };
const summaryPrice: CSSProperties = { margin: 0, fontSize: '0.95rem', fontWeight: 700, color: '#095ae9' };

const fieldGrid: CSSProperties = {
  display: 'grid',
  gap: '0.65rem',
  gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))'
};

const fieldCard: CSSProperties = {
  display: 'grid',
  gap: '0.2rem',
  padding: '0.75rem',
  borderRadius: '0.75rem',
  background: '#f9fafb',
  border: '1px solid #e5e7eb'
};

const fieldLabel: CSSProperties = {
  fontSize: '0.72rem',
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: '#6b7280'
};

const fieldValue: CSSProperties = {
  color: '#0b192d',
  fontSize: '0.88rem'
};

const toggleRow: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.5rem',
  fontSize: '0.82rem',
  color: '#374151'
};

const errorText: CSSProperties = {
  margin: 0,
  padding: '0.7rem 0.8rem',
  borderRadius: '0.75rem',
  background: 'rgba(192,57,43,0.08)',
  border: '1px solid rgba(192,57,43,0.18)',
  color: '#c0392b',
  fontSize: '0.82rem'
};

const actions: CSSProperties = {
  display: 'flex',
  justifyContent: 'flex-end',
  gap: '0.65rem',
  flexWrap: 'wrap'
};

const cancelButton: CSSProperties = {
  border: '1px solid #e5e7eb',
  borderRadius: '0.55rem',
  padding: '0.7rem 1rem',
  background: '#ffffff',
  color: '#374151',
  fontWeight: 600,
  cursor: 'pointer'
};

const confirmButton: CSSProperties = {
  border: 'none',
  borderRadius: '0.55rem',
  padding: '0.7rem 1rem',
  background: '#16a34a',
  color: '#ffffff',
  fontWeight: 700,
  cursor: 'pointer'
};
