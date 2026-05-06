import type { CSSProperties } from 'react';
import type { SaleItem, SessionResponse } from '../api/client';
import { CartStatusRail } from '../components/CartStatusRail';
import { PageShell } from '../components/PageShell';
import { formatUsd, storefrontPrice } from '../storefrontPricing';
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
  const price = storefrontPrice(selectedSale.itemName, selectedSale.price);
  const holdMinutes = `${selectedSale.reservationTtlSeconds / 60} min`;

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
              <span style={caption}>{formatWindow(selectedSale.startsAt, selectedSale.endsAt)}</span>
            </div>
            <div style={titleRow}>
              <h2 style={detailTitle}>{selectedSale.itemName}</h2>
              <p style={detailPrice}>{price === null ? 'Price unavailable' : formatUsd(price)}</p>
            </div>
            <p style={detailLead}>{productBody(selectedSale.itemName)}</p>
            <div style={metaGrid}>
              <StatCard label="Hold length" value={holdMinutes} />
              <StatCard label="Status" value={selectedSale.status} />
              <StatCard label="Checkout" value={cartItem ? 'Ready when you are' : 'Add to cart to hold'} />
            </div>

            <div style={notePanel}>
              {isPurchased
                ? 'Your purchase is complete. You can return to the product board whenever you want.'
                : cartItem
                  ? 'Your hold is active. You can keep browsing or remove this item before the timer expires.'
                  : `Adding to cart creates a ${holdMinutes} hold so you can finish checkout before the drop ends.`}
            </div>

            <div style={actionCard}>
            {isPurchased ? (
              <>
                <p style={eyebrow}>Purchased</p>
                <h3 style={sectionTitle}>You already own this item</h3>
                <p style={purchasedBanner}>✓ Already purchased</p>
                <div style={buttonWell}>
                  <button style={wellButton(ghostButton)} onClick={onBack}>Back to products</button>
                </div>
              </>
            ) : cartItem ? (
              <>
                <p style={eyebrow}>Cart state</p>
                <h3 style={sectionTitle}>This item is held in your cart</h3>
                <div style={holdBanner}>
                  <span>Hold expires in</span>
                  <strong>{formatRemaining(cartItem.expiresAt, now)}</strong>
                </div>
                <p style={bodyText}>Pick up more items or head straight to checkout from the cart rail.</p>
                <div style={buttonWell}>
                  <button style={wellButton(ghostButton)} onClick={onBack}>Back to products</button>
                  <button style={wellButton(secondaryButton)} disabled>
                    Add to cart
                  </button>
                  <button
                    style={wellButton(removeButton)}
                    disabled={isCancelling}
                    onClick={() => onRemoveFromCart(cartItem.reservationId)}
                  >
                    {isCancelling ? 'Removing...' : 'Remove from cart'}
                  </button>
                </div>
              </>
            ) : (
              <>
                <p style={eyebrow}>Decision layout</p>
                <h3 style={sectionTitle}>Reserve before the window closes</h3>
                <p style={bodyText}>Add this item on the left, then review timing and totals in the rail once it is held.</p>
                <div style={buttonWell}>
                  <button style={wellButton(ghostButton)} onClick={onBack}>Back to products</button>
                  <button
                    style={wellButton(primaryButton)}
                    disabled={!isActive || isReserving}
                    onClick={onAddToCart}
                  >
                    {isReserving ? 'Adding...' : isActive ? 'Add to cart' : 'Currently unavailable'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

          <div style={sidebar}>
            {cart.length > 0 ? (
              <CartStatusRail cart={cart} now={now} onProceedToCheckout={onProceedToCheckout} />
            ) : (
              <aside aria-hidden="true" style={railPlaceholder} />
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

function productBody(itemName: string) {
  if (itemName === 'Founder Tee') return 'Heavyweight tee from the founder collection with limited stock for this drop.';
  if (itemName === 'Bookipi Cap') return 'Embroidered cap in the current drop.';
  return 'Limited drop item with a short sale window.';
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
  gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))'
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
  margin: 0,
  fontSize: 'clamp(1.45rem, 2.8vw, 2.1rem)',
  lineHeight: 1.05,
  fontWeight: 700,
  color: '#0b192d'
};

const titleRow: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'baseline',
  gap: '0.75rem',
  marginTop: '0.9rem',
  flexWrap: 'wrap'
};

const detailPrice: CSSProperties = {
  margin: 0,
  color: '#095ae9',
  fontSize: '1.05rem',
  fontWeight: 700
};

const detailLead: CSSProperties = { margin: '0.6rem 0 0', color: '#374151', lineHeight: 1.5, fontSize: '0.9rem' };

const metaGrid: CSSProperties = {
  display: 'grid',
  gap: '0.5rem',
  gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
  marginTop: '1rem'
};

const actionCard: CSSProperties = {
  display: 'grid',
  gap: '0.75rem',
  marginTop: '1rem',
  padding: '1rem',
  borderRadius: '0.875rem',
  background: 'rgba(255,255,255,0.88)',
  border: '1px solid rgba(9,90,233,0.08)',
  justifyItems: 'start'
};

const notePanel: CSSProperties = {
  marginTop: '1rem',
  padding: '0.85rem 0.95rem',
  borderRadius: '0.75rem',
  background: 'rgba(224,240,255,0.55)',
  border: '1px solid rgba(9,90,233,0.1)',
  color: '#374151',
  lineHeight: 1.5,
  fontSize: '0.88rem'
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

const railPlaceholder: CSSProperties = {
  minHeight: '100%',
  borderRadius: '0.875rem',
  background: 'linear-gradient(180deg, rgba(255,255,255,0.7) 0%, rgba(242,247,255,0.85) 100%)',
  border: '1px dashed rgba(9,90,233,0.14)',
  boxShadow: '0 1px 6px rgba(9,90,233,0.04)'
};

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

const buttonWell: CSSProperties = {
  display: 'grid',
  gap: '0.75rem',
  justifyItems: 'end',
  width: '100%',
  maxWidth: '16rem'
};

function wellButton(base: CSSProperties): CSSProperties {
  return {
    ...base,
    width: '16rem',
    justifySelf: 'end'
  };
}

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

const secondaryButton: CSSProperties = {
  border: '1px solid #e5e7eb',
  borderRadius: '0.5rem',
  padding: '0.65rem 0.95rem',
  fontWeight: 600,
  fontSize: '0.82rem',
  cursor: 'default',
  background: '#f9fafb',
  color: '#9ca3af'
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
