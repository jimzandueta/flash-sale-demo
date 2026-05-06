import type { CSSProperties } from 'react';
import { formatUsd, storefrontPrice } from '../storefrontPricing';
import type { CartReservation } from '../types';

type Props = {
  cart: CartReservation[];
  now: number;
  onProceedToCheckout: () => void;
};

export function CartStatusRail({ cart, now, onProceedToCheckout }: Props) {
  const total = cart.reduce((sum, item) => sum + (storefrontPrice(item.itemName, item.price) ?? 0), 0);

  return (
    <aside style={rail}>
      <div style={railHeader}>
        <h2 style={title}>Cart</h2>
        <span style={count}>{cart.length} {cart.length === 1 ? 'item' : 'items'}</span>
      </div>

      <div style={list}>
        {cart.map((item) => (
          <article key={item.reservationId} style={row}>
            <div aria-hidden="true" style={imagePlaceholder}>IMG</div>
            <div style={itemDetails}>
              <strong style={itemName}>{item.itemName}</strong>
              <div style={itemMeta}>
                <span>{formatPrice(item.itemName, item.price)}</span>
                <span>{formatRemaining(item.expiresAt, now)} left</span>
              </div>
            </div>
          </article>
        ))}
      </div>

      <div style={footer}>
        <div style={totalRow}>
          <span style={footerLabel}>Total</span>
          <strong style={footerValue}>{formatUsd(total)}</strong>
        </div>
        <button style={checkoutButton} onClick={onProceedToCheckout}>
          Go to checkout
        </button>
      </div>
    </aside>
  );
}

function formatPrice(itemName: string, price?: number) {
  const resolved = storefrontPrice(itemName, price);
  return resolved === null ? 'Price unavailable' : formatUsd(resolved);
}

function formatRemaining(expiresAt: string, now: number) {
  const ms = Date.parse(expiresAt) - now;
  if (ms <= 0) return '0:00';
  const seconds = Math.floor(ms / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

const rail: CSSProperties = {
  display: 'grid',
  gap: '0.9rem',
  alignSelf: 'start',
  padding: '0.9rem',
  borderRadius: '0.875rem',
  background: '#ffffff',
  border: '1px solid #e5e7eb',
  boxShadow: '0 1px 6px rgba(9,90,233,0.06)'
};

const railHeader: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: '0.75rem'
};

const title: CSSProperties = {
  margin: 0,
  fontSize: '1rem',
  fontWeight: 700,
  color: '#0b192d'
};

const count: CSSProperties = {
  fontSize: '0.76rem',
  color: '#6b7280'
};

const list: CSSProperties = {
  display: 'grid',
  gap: '0.6rem'
};

const row: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '3rem minmax(0, 1fr)',
  gap: '0.75rem',
  alignItems: 'center',
  padding: '0.55rem 0',
  borderTop: '1px solid #f3f4f6'
};

const imagePlaceholder: CSSProperties = {
  display: 'grid',
  placeItems: 'center',
  width: '3rem',
  height: '3rem',
  borderRadius: '0.7rem',
  background: '#f3f4f6',
  color: '#9ca3af',
  fontSize: '0.68rem',
  fontWeight: 700,
  letterSpacing: '0.08em'
};

const itemDetails: CSSProperties = {
  display: 'grid',
  gap: '0.25rem',
  minWidth: 0
};

const itemName: CSSProperties = {
  color: '#0b192d',
  fontSize: '0.86rem'
};

const itemMeta: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: '0.75rem',
  color: '#6b7280',
  fontSize: '0.76rem'
};

const footer: CSSProperties = {
  display: 'grid',
  gap: '0.75rem',
  paddingTop: '0.75rem',
  borderTop: '1px solid #e5e7eb'
};

const totalRow: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: '0.75rem'
};

const footerLabel: CSSProperties = {
  color: '#374151',
  fontWeight: 600
};

const footerValue: CSSProperties = {
  color: '#0b192d'
};

const checkoutButton: CSSProperties = {
  border: 'none',
  borderRadius: '0.5rem',
  padding: '0.7rem 0.95rem',
  fontWeight: 700,
  fontSize: '0.82rem',
  cursor: 'pointer',
  background: '#095ae9',
  color: '#ffffff',
  width: '100%'
};
