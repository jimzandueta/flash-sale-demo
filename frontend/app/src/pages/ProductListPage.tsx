import type { CSSProperties } from 'react';
import type { SaleItem, SessionResponse } from '../api/client';
import { PageShell } from '../components/PageShell';
import type { CartReservation, Notice } from '../types';

type Props = {
  session: SessionResponse | null;
  notice: Notice | null;
  sales: SaleItem[];
  cart: CartReservation[];
  purchasedSaleIds: Set<string>;
  isLoadingCatalog: boolean;
  now: number;
  onViewProduct: (saleId: string) => void;
  onProceedToCheckout: () => void;
};

export function ProductListPage({
  session,
  notice,
  sales,
  cart,
  purchasedSaleIds,
  isLoadingCatalog,
  now,
  onViewProduct,
  onProceedToCheckout
}: Props) {
  return (
    <PageShell
      page="product-list"
      title="Product List"
      description="Browse active drops, hold items, and proceed to checkout when you're ready."
      session={session}
      notice={notice}
    >
      {cart.length > 0 ? (
        <div style={cartBar}>
          <span style={cartBarText}>{cart.length} {cart.length === 1 ? 'item' : 'items'} held</span>
          <button style={cartBarBtn} onClick={onProceedToCheckout}>
            Proceed to checkout →
          </button>
        </div>
      ) : null}

      {isLoadingCatalog ? (
        <section style={contentCard}>
          <p style={loadingText}>Syncing the product board...</p>
        </section>
      ) : (
        <section style={productGrid}>
          {sales.map((sale) => {
            const cartItem = cart.find((item) => item.saleId === sale.saleId);
            const isPurchased = purchasedSaleIds.has(sale.saleId);

            return (
              <article key={sale.saleId} style={productCard}>
                <div style={cardTop}>
                  <span style={statusPill(sale.status)}>{sale.status}</span>
                  <span style={holdText}>{sale.reservationTtlSeconds / 60} min hold</span>
                </div>
                <h2 style={cardTitle}>{sale.itemName}</h2>
                <p style={skuText}>{sale.saleId}</p>
                <p style={windowText}>{formatWindow(sale.startsAt, sale.endsAt)}</p>

                {isPurchased ? <p style={purchasedBanner}>✓ Already purchased</p> : null}

                {!isPurchased && cartItem ? (
                  <div style={holdBanner}>
                    <span>In cart</span>
                    <strong>{formatRemaining(cartItem.expiresAt, now)}</strong>
                  </div>
                ) : null}

                {isPurchased ? (
                  <button style={disabledButton} disabled>Already purchased</button>
                ) : (
                  <button style={secondaryButton} onClick={() => onViewProduct(sale.saleId)}>
                    View product
                  </button>
                )}
              </article>
            );
          })}
        </section>
      )}
    </PageShell>
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

  return { ...baseChip, ...palette[status], borderColor: 'transparent' };
}

const baseChip: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: '2rem',
  padding: '0.4rem 0.75rem',
  borderRadius: '999px',
  border: '1px solid',
  fontSize: '0.76rem',
  fontWeight: 700,
  letterSpacing: '0.08em',
  textTransform: 'uppercase'
};

const cartBar: CSSProperties = {
  background: '#e0f0ff',
  border: '1px solid rgba(9,90,233,0.18)',
  borderRadius: '0.6rem',
  padding: '0.6rem 0.9rem',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: '1rem'
};

const cartBarText: CSSProperties = { fontSize: '0.85rem', fontWeight: 600, color: '#095ae9' };

const cartBarBtn: CSSProperties = {
  border: 'none',
  borderRadius: '0.4rem',
  padding: '0.35rem 0.75rem',
  fontSize: '0.8rem',
  fontWeight: 700,
  cursor: 'pointer',
  background: '#095ae9',
  color: '#ffffff'
};

const contentCard: CSSProperties = {
  display: 'grid',
  gap: '0.9rem',
  padding: '1rem',
  borderRadius: '0.875rem',
  background: '#ffffff',
  border: '1px solid #e5e7eb',
  boxShadow: '0 1px 6px rgba(9,90,233,0.06)'
};

const loadingText: CSSProperties = { margin: 0, color: '#374151', lineHeight: 1.6 };

const productGrid: CSSProperties = {
  display: 'grid',
  gap: '0.6rem',
  gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))'
};

const productCard: CSSProperties = {
  display: 'grid',
  gap: '0.55rem',
  padding: '0.75rem',
  borderRadius: '0.75rem',
  background: '#ffffff',
  border: '1px solid #e5e7eb',
  boxShadow: '0 1px 6px rgba(9,90,233,0.06)'
};

const cardTop: CSSProperties = { display: 'flex', justifyContent: 'space-between', gap: '0.75rem', alignItems: 'center' };

const cardTitle: CSSProperties = {
  margin: 0,
  fontSize: '0.96rem',
  fontWeight: 700,
  color: '#0b192d'
};

const skuText: CSSProperties = { margin: 0, color: '#6b7280', fontSize: '0.76rem' };
const windowText: CSSProperties = { margin: 0, fontWeight: 600, color: '#6b7280', fontSize: '0.76rem' };
const holdText: CSSProperties = { fontSize: '0.65rem', color: '#6b7280' };

const holdBanner: CSSProperties = {
  margin: 0,
  padding: '0.3rem 0.55rem',
  borderRadius: '0.4rem',
  background: '#e0f0ff',
  color: '#095ae9',
  fontSize: '0.75rem',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center'
};

const purchasedBanner: CSSProperties = {
  margin: 0,
  padding: '0.3rem 0.55rem',
  borderRadius: '0.4rem',
  background: '#dcfce7',
  color: '#166534',
  fontSize: '0.75rem'
};

const secondaryButton: CSSProperties = {
  border: '1px solid #e5e7eb',
  borderRadius: '0.4rem',
  padding: '0.3rem 0.6rem',
  fontWeight: 600,
  fontSize: '0.75rem',
  cursor: 'pointer',
  background: '#ffffff',
  color: '#374151',
  width: '100%'
};

const disabledButton: CSSProperties = {
  border: 'none',
  borderRadius: '0.4rem',
  padding: '0.3rem 0.6rem',
  fontWeight: 600,
  fontSize: '0.75rem',
  cursor: 'default',
  background: '#f3f4f6',
  color: '#9ca3af',
  width: '100%'
};
