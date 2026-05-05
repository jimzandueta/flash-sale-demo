import type { CSSProperties } from 'react';
import type { SaleItem, SessionResponse } from '../api/client';
import { PageShell } from '../components/PageShell';
import type { CartReservation, Notice } from '../types';

type Props = {
  session: SessionResponse | null;
  notice: Notice | null;
  selectedSale: SaleItem;
  cart: CartReservation[];
  purchasedSaleIds: Set<string>;
  isReserving: boolean;
  isCancellingIds: Set<string>;
  now: number;
  onAddToCart: () => void;
  onRemoveFromCart: (reservationId: string) => void;
  onProceedToCheckout: () => void;
  onBack: () => void;
};

export function ProductPage({
  session,
  notice,
  selectedSale,
  cart,
  purchasedSaleIds,
  isReserving,
  isCancellingIds,
  now,
  onAddToCart,
  onRemoveFromCart,
  onProceedToCheckout,
  onBack
}: Props) {
  const cartItem = cart.find((item) => item.saleId === selectedSale.saleId) ?? null;
  const isPurchased = purchasedSaleIds.has(selectedSale.saleId);
  const isActive = selectedSale.status === 'active';
  const isCancelling = cartItem ? isCancellingIds.has(cartItem.reservationId) : false;

  return (
    <PageShell
      page="product-page"
      title={selectedSale.itemName}
      description={formatWindow(selectedSale.startsAt, selectedSale.endsAt)}
      session={session}
      notice={notice}
    >
      <section style={detailLayout}>
        <div style={heroCard}>
          <div style={heroTop}>
            <span style={statusPill(selectedSale.status)}>{selectedSale.status}</span>
            <span style={caption}>Flash drop detail</span>
          </div>
          <h2 style={detailTitle}>{selectedSale.itemName}</h2>
          <p style={detailLead}>{formatWindow(selectedSale.startsAt, selectedSale.endsAt)}</p>
          <div style={metaGrid}>
            <StatCard label="Sale ID" value={selectedSale.saleId} />
            <StatCard label="Hold length" value={`${selectedSale.reservationTtlSeconds / 60} min`} />
            <StatCard label="Status" value={selectedSale.status} />
          </div>
        </div>

        <div style={sidebar}>
          {isPurchased ? (
            <div style={contentCard}>
              <p style={eyebrow}>Purchase confirmed</p>
              <h3 style={sectionTitle}>You already own this item</h3>
              <p style={purchasedBanner}>✓ Already purchased</p>
              <div style={btnRow}>
                <button style={ghostButton} onClick={onBack}>← Back to products</button>
              </div>
            </div>
          ) : cartItem ? (
            <div style={contentCard}>
              <p style={eyebrow}>Cart state</p>
              <h3 style={sectionTitle}>This item is held in your cart</h3>
              <div style={holdBanner}>
                <span>Hold expires in</span>
                <strong>{formatRemaining(cartItem.expiresAt, now)}</strong>
              </div>
              <p style={bodyText}>Pick up more items or head straight to checkout.</p>
              <div style={btnRow}>
                <button
                  style={removeButton}
                  disabled={isCancelling}
                  onClick={() => onRemoveFromCart(cartItem.reservationId)}
                >
                  {isCancelling ? 'Removing...' : 'Remove from cart'}
                </button>
              </div>
              <div style={{ ...btnRow, marginTop: '0.4rem' }}>
                <button style={ghostButton} onClick={onBack}>← Keep shopping</button>
                <button style={primaryButton} onClick={onProceedToCheckout}>
                  Proceed to checkout →
                </button>
              </div>
            </div>
          ) : (
            <div style={contentCard}>
              <p style={eyebrow}>Decision point</p>
              <h3 style={sectionTitle}>Reserve before the window closes</h3>
              <p style={bodyText}>
                Adding to cart creates a {selectedSale.reservationTtlSeconds / 60}-minute hold.
                You can continue shopping while it's held.
              </p>
              <div style={btnRow}>
                <button style={ghostButton} onClick={onBack}>← Products</button>
                <button
                  style={primaryButton}
                  disabled={!isActive || isReserving}
                  onClick={onAddToCart}
                >
                  {isReserving ? 'Adding...' : isActive ? 'Add to cart' : 'Currently unavailable'}
                </button>
              </div>
            </div>
          )}
        </div>
      </section>
    </PageShell>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div style={statCard}>
      <span style={statLabel}>{label}</span>
      <strong style={statValue}>{value}</strong>
    </div>
  );
}

function formatRemaining(expiresAt: string, now: number) {
  const ms = Date.parse(expiresAt) - now;
  if (ms <= 0) return '0:00';
  const seconds = Math.floor(ms / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

function formatWindow(startsAt: string, endsAt: string) {
  const fmt = (value: string) => new Date(value).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  return `${fmt(startsAt)} - ${fmt(endsAt)}`;
}

function statusPill(status: SaleItem['status']): CSSProperties {
  const palette = {
    active: { background: '#dcfce7', color: '#166534' },
    upcoming: { background: '#fef9c3', color: '#854d0e' },
    ended: { background: '#f3f4f6', color: '#4b5563' }
  };

  return {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '2rem',
    padding: '0.4rem 0.75rem',
    borderRadius: '999px',
    border: '1px solid transparent',
    fontSize: '0.76rem',
    fontWeight: 700,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    ...palette[status]
  };
}

const detailLayout: CSSProperties = {
  display: 'grid',
  gap: '0.8rem',
  gridTemplateColumns: 'minmax(0, 1.2fr) minmax(320px, 0.8fr)'
};

const heroCard: CSSProperties = {
  padding: '1rem',
  borderRadius: '0.875rem',
  minHeight: '100%',
  background: 'linear-gradient(180deg, #ffffff 0%, #f2f7ff 100%)',
  border: '1px solid rgba(9,90,233,0.12)',
  boxShadow: '0 1px 6px rgba(9,90,233,0.06)'
};

const heroTop: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: '0.75rem',
  alignItems: 'center'
};

const caption: CSSProperties = {
  fontSize: '0.7rem',
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
  color: '#095ae9'
};

const detailTitle: CSSProperties = {
  margin: '0.75rem 0 0.45rem',
  fontSize: 'clamp(1.8rem, 3.2vw, 2.6rem)',
  lineHeight: 1.05,
  fontWeight: 700,
  color: '#0b192d'
};

const detailLead: CSSProperties = { margin: 0, color: '#374151', lineHeight: 1.5, fontSize: '0.9rem' };

const metaGrid: CSSProperties = {
  display: 'grid',
  gap: '0.5rem',
  gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
  marginTop: '1rem'
};

const statCard: CSSProperties = {
  display: 'grid',
  gap: '0.35rem',
  padding: '0.8rem',
  borderRadius: '0.75rem',
  background: 'rgba(255,255,255,0.8)',
  border: '1px solid rgba(9,90,233,0.08)'
};

const statLabel: CSSProperties = {
  fontSize: '0.78rem',
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
  color: '#6b7280'
};

const statValue: CSSProperties = { color: '#0b192d' };

const sidebar: CSSProperties = { display: 'grid', gap: '1rem' };

const contentCard: CSSProperties = {
  display: 'grid',
  gap: '0.75rem',
  padding: '1rem',
  borderRadius: '0.875rem',
  background: '#ffffff',
  border: '1px solid #e5e7eb',
  boxShadow: '0 1px 6px rgba(9,90,233,0.06)'
};

const eyebrow: CSSProperties = {
  margin: 0,
  fontSize: '0.7rem',
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
  color: '#095ae9',
  fontWeight: 700
};

const sectionTitle: CSSProperties = {
  margin: '0.2rem 0 0.45rem',
  fontSize: '1.15rem',
  fontWeight: 700,
  color: '#0b192d'
};

const bodyText: CSSProperties = { margin: 0, color: '#374151', lineHeight: 1.55, fontSize: '0.9rem' };

const holdBanner: CSSProperties = {
  margin: 0,
  padding: '0.55rem 0.75rem',
  borderRadius: '0.6rem',
  background: '#e0f0ff',
  color: '#095ae9',
  fontSize: '0.8rem',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center'
};

const purchasedBanner: CSSProperties = {
  margin: 0,
  padding: '0.55rem 0.75rem',
  borderRadius: '0.6rem',
  background: '#dcfce7',
  color: '#166534',
  fontSize: '0.8rem'
};

const btnRow: CSSProperties = { display: 'flex', flexWrap: 'wrap', gap: '0.75rem' };

const primaryButton: CSSProperties = {
  border: 'none',
  borderRadius: '0.5rem',
  padding: '0.65rem 0.95rem',
  fontWeight: 700,
  fontSize: '0.82rem',
  cursor: 'pointer',
  background: '#095ae9',
  color: '#ffffff'
};

const ghostButton: CSSProperties = {
  border: '1px solid #e5e7eb',
  borderRadius: '0.5rem',
  padding: '0.6rem 0.9rem',
  fontWeight: 600,
  fontSize: '0.8rem',
  cursor: 'pointer',
  background: 'transparent',
  color: '#374151'
};

const removeButton: CSSProperties = {
  border: '1px solid rgba(192,57,43,0.3)',
  borderRadius: '0.5rem',
  padding: '0.45rem 0.75rem',
  fontWeight: 600,
  fontSize: '0.75rem',
  cursor: 'pointer',
  background: 'transparent',
  color: '#c0392b'
};
