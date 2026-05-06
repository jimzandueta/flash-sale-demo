import type { CSSProperties, ReactNode } from 'react';
import type { SaleItem, SessionResponse } from '../api/client';
import { CartStatusRail } from '../components/CartStatusRail';
import { PageShell } from '../components/PageShell';
import { storefrontMeta } from '../storefrontCatalog';
import { formatUsd, storefrontPrice } from '../storefrontPricing';
import { formatRemaining, formatWindow } from '../dateUtils';
import type { CartReservation, Notice } from '../types';

type Props = {
  session: SessionResponse | null;
  notice: Notice | null;
  selectedSale: SaleItem;
  cart: CartReservation[];
  cartRailItems?: CartReservation[];
  purchasedSaleIds: Set<string>;
  isReserving: boolean;
  isCancellingIds: Set<string>;
  now: number;
  dock?: ReactNode;
  onAddToCart: () => void;
  onRemoveFromCart: (reservationId: string) => void;
  onProceedToCheckout: () => void;
  onBack: () => void;
};

export function ProductPage({
  notice,
  selectedSale,
  cart,
  cartRailItems,
  purchasedSaleIds,
  isReserving,
  isCancellingIds,
  now,
  dock,
  onAddToCart,
  onRemoveFromCart,
  onProceedToCheckout,
  onBack
}: Props) {
  const cartItem = cart.find((item) => item.saleId === selectedSale.saleId) ?? null;
  const isPurchased = purchasedSaleIds.has(selectedSale.saleId);
  const isActive = selectedSale.status === 'active';
  const isCancelling = cartItem ? isCancellingIds.has(cartItem.reservationId) : false;
  const isNarrow = typeof window !== 'undefined' && window.innerWidth <= 960;
  const price = storefrontPrice(selectedSale.itemName, selectedSale.price);
  const product = storefrontMeta(selectedSale.itemName);
  const holdMinutes = `${selectedSale.reservationTtlSeconds / 60} minutes`;
  const railItems = cartRailItems ?? cart;
  const expiredCartItem =
    railItems.find(
      (item) => item.saleId === selectedSale.saleId && (item.state === 'expired' || Date.parse(item.expiresAt) <= now)
    ) ?? null;
  const isSoldOut =
    selectedSale.status === 'active' &&
    selectedSale.remainingStock !== undefined &&
    selectedSale.remainingStock <= 0;

  return (
    <PageShell
      header={{
        eyebrow: 'KooPiBi / Flash Sale / Product',
        headline: product.displayName,
        supportingCopy: product.detailCopy
      }}
      notice={notice}
      dock={dock}
    >
      <section
        style={{
          ...detailLayout,
          gridTemplateColumns: isNarrow ? '1fr' : detailLayout.gridTemplateColumns
        }}
      >
        <article style={heroCard}>
          <div style={heroTop}>
            <span style={statusPill(selectedSale.status)}>{statusLabel(selectedSale.status)}</span>
            <span style={windowPill}>{formatWindow(selectedSale.startsAt, selectedSale.endsAt)}</span>
          </div>

          <div
            style={{
              ...heroBody,
              gridTemplateColumns: isNarrow ? '1fr' : heroBody.gridTemplateColumns
            }}
          >
            <div aria-hidden="true" style={{ ...heroArt, background: product.gradient }} />

            <div style={productCopy}>
              <div style={productHead}>
                <h1 style={productTitle}>{product.displayName}</h1>
                <span style={productPrice}>{price === null ? 'Price unavailable' : formatUsd(price)}</span>
              </div>

              <p style={productBodyText}>{productBody(selectedSale.itemName)}</p>

              <div
                style={{
                  ...specGrid,
                  gridTemplateColumns: isNarrow ? '1fr' : specGrid.gridTemplateColumns
                }}
              >
                <SpecCard label="Hold length" value={holdMinutes} />
                <SpecCard
                  label="Status"
                  value={statusValue(selectedSale.status, cartItem, expiredCartItem, isPurchased, isSoldOut)}
                />
                <SpecCard label="Checkout" value="One item at a time" />
              </div>
            </div>
          </div>

          <div style={detailFooter}>
            <div style={detailNotes}>
              {cartItem ? (
                <>
                  <p>This item is held in your cart.</p>
                  <p>Hold expires in {formatRemaining(cartItem.expiresAt, now)}. You can keep browsing or go straight to checkout from the rail.</p>
                </>
              ) : expiredCartItem ? (
                <>
                  <p>This hold expired and was returned to stock.</p>
                  <p>Remove it from your cart before trying again.</p>
                </>
              ) : isPurchased ? (
                <>
                  <p>Your purchase is complete.</p>
                  <p>You can return to the product board whenever you want.</p>
                </>
              ) : isSoldOut ? (
                <p>All flash-sale slots for this item have been claimed.</p>
              ) : (
                <p>Add this item to your cart to start a timed hold. You can keep shopping, then pay each held item separately in checkout.</p>
              )}
            </div>

            <div style={detailActions}>
              {cartItem ? (
                <div style={{ ...buttonRowTwo, gridTemplateColumns: isNarrow ? '1fr' : buttonRowTwo.gridTemplateColumns }}>
                  <button style={secondaryButton} onClick={onBack}>Back to products</button>
                  <button style={secondaryDangerButton} disabled={isCancelling} onClick={() => onRemoveFromCart(cartItem.reservationId)}>
                    {isCancelling ? 'Removing...' : 'Remove from cart'}
                  </button>
                </div>
              ) : expiredCartItem ? (
                <div style={{ ...buttonRowTwo, gridTemplateColumns: isNarrow ? '1fr' : buttonRowTwo.gridTemplateColumns }}>
                  <button style={secondaryButton} onClick={onBack}>Back to products</button>
                  <button
                    style={secondaryDangerButton}
                    disabled={isCancellingIds.has(expiredCartItem.reservationId)}
                    onClick={() => onRemoveFromCart(expiredCartItem.reservationId)}
                  >
                    {isCancellingIds.has(expiredCartItem.reservationId) ? 'Removing...' : 'Remove from cart'}
                  </button>
                </div>
              ) : isPurchased ? (
                <div style={{ ...buttonRowTwo, gridTemplateColumns: isNarrow ? '1fr' : buttonRowTwo.gridTemplateColumns }}>
                  <button style={secondaryButton} onClick={onBack}>Back to products</button>
                </div>
              ) : isSoldOut ? (
                <div style={{ ...buttonRowTwo, gridTemplateColumns: isNarrow ? '1fr' : buttonRowTwo.gridTemplateColumns }}>
                  <button style={secondaryButton} onClick={onBack}>Back to products</button>
                  <button style={disabledButton} disabled>
                    Sold out
                  </button>
                </div>
              ) : (
                <div style={{ ...buttonRowTwo, gridTemplateColumns: isNarrow ? '1fr' : buttonRowTwo.gridTemplateColumns }}>
                  <button style={secondaryButton} onClick={onBack}>Back to products</button>
                  <button style={primaryButton} disabled={!isActive || isReserving} onClick={onAddToCart}>
                    {isReserving ? 'Adding...' : isActive ? 'Add to cart' : 'Currently unavailable'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </article>

        <CartStatusRail cart={cartRailItems ?? cart} now={now} onProceedToCheckout={onProceedToCheckout} />
      </section>
    </PageShell>
  );
}

function SpecCard({ label, value }: { label: string; value: string }) {
  return (
    <div style={specCard}>
      <span style={specLabel}>{label}</span>
      <span style={specValue}>{value}</span>
    </div>
  );
}

function productBody(itemName: string) {
  if (itemName === 'Founder Tee') return 'Heavyweight tee from the founder collection with limited stock for this drop.';
  if (itemName === 'KooPiBi Cap') return 'Embroidered cap in the current drop.';
  return 'Limited drop item with a short sale window.';
}

function statusLabel(status: SaleItem['status']) {
  if (status === 'active') return 'Live now';
  if (status === 'upcoming') return 'Soon';
  return 'Ended';
}

function statusValue(
  status: SaleItem['status'],
  cartItem: CartReservation | null,
  expiredCartItem: CartReservation | null,
  isPurchased: boolean,
  isSoldOut: boolean
) {
  if (isPurchased) return 'Purchased';
  if (cartItem) return 'Held in cart';
  if (expiredCartItem) return 'Expired hold';
  if (isSoldOut) return 'Sold out';
  if (status === 'active') return 'Available now';
  if (status === 'upcoming') return 'Upcoming';
  return 'Ended';
}

function statusPill(status: SaleItem['status']): CSSProperties {
  if (status === 'active') {
    return {
      ...pillBase,
      background: '#eef2ff',
      color: '#4f46e5'
    };
  }

  if (status === 'upcoming') {
    return {
      ...pillBase,
      background: '#fef9c3',
      color: '#854d0e'
    };
  }

  return {
    ...pillBase,
    background: '#f3f4f6',
    color: '#4b5563'
  };
}

const detailLayout: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr) 372px',
  gap: '18px',
  alignItems: 'start'
};

const heroCard: CSSProperties = {
  display: 'grid',
  gap: '18px',
  padding: '20px',
  borderRadius: '22px',
  border: '1px solid rgba(95,111,255,.14)',
  boxShadow: '0 18px 36px rgba(95,111,255,.08)',
  background: 'linear-gradient(180deg,#ffffff 0%,#f8faff 100%)'
};

const heroTop: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: '12px',
  flexWrap: 'wrap'
};

const pillBase: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: '30px',
  padding: '0 12px',
  borderRadius: '999px',
  fontSize: '11px',
  fontWeight: 700,
  letterSpacing: '0.08em',
  textTransform: 'uppercase'
};

const windowPill: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: '30px',
  padding: '0 12px',
  borderRadius: '999px',
  background: '#f8fafc',
  color: '#475467',
  fontSize: '11px',
  fontWeight: 700,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  border: '1px solid rgba(15,23,42,.08)'
};

const heroBody: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '220px minmax(0, 1fr)',
  gap: '18px',
  alignItems: 'start'
};

const heroArt: CSSProperties = {
  aspectRatio: '1 / 1',
  borderRadius: '22px',
  border: '1px solid rgba(15,23,42,.08)',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,.35)'
};

const productCopy: CSSProperties = {
  display: 'grid',
  gap: '12px'
};

const productHead: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: '16px',
  flexWrap: 'wrap'
};

const productTitle: CSSProperties = {
  margin: 0,
  fontSize: '34px',
  lineHeight: 0.98,
  color: '#101828'
};

const productPrice: CSSProperties = {
  fontSize: '36px',
  fontWeight: 800,
  lineHeight: 0.98,
  color: '#101828',
  textAlign: 'right',
  whiteSpace: 'nowrap'
};

const productBodyText: CSSProperties = {
  margin: 0,
  fontSize: '15px',
  lineHeight: 1.5,
  color: '#667085',
  maxWidth: '38rem'
};

const specGrid: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(3,minmax(0,1fr))',
  gap: '12px'
};

const specCard: CSSProperties = {
  display: 'grid',
  gap: '6px',
  padding: '14px',
  borderRadius: '16px',
  background: '#fff',
  border: '1px solid rgba(95,111,255,.12)'
};

const specLabel: CSSProperties = {
  fontSize: '11px',
  fontWeight: 700,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: '#667085'
};

const specValue: CSSProperties = {
  fontSize: '14px',
  fontWeight: 700,
  color: '#101828'
};

const detailFooter: CSSProperties = {
  display: 'grid',
  gap: '12px'
};

const detailNotes: CSSProperties = {
  display: 'grid',
  gap: '12px',
  padding: '16px',
  borderRadius: '18px',
  background: 'rgba(95,111,255,.05)',
  border: '1px solid rgba(95,111,255,.10)'
};

const detailActions: CSSProperties = {
  display: 'grid',
  justifyContent: 'end',
  padding: '16px',
  borderRadius: '18px',
  background: '#fff',
  border: '1px solid rgba(95,111,255,.12)'
};

const buttonRowTwo: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(160px, 1fr))',
  gap: '10px',
  width: 'min(100%, 340px)'
};

const buttonRowThree: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(3, minmax(160px, 1fr))',
  gap: '10px',
  width: 'min(100%, 520px)'
};

const buttonBase: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '100%',
  boxSizing: 'border-box',
  borderRadius: '12px',
  padding: '10px 14px',
  fontWeight: 700,
  fontSize: '13px',
  border: '1px solid transparent'
};

const primaryButton: CSSProperties = {
  ...buttonBase,
  background: '#5f6fff',
  color: '#fff',
  borderColor: '#5f6fff'
};

const secondaryButton: CSSProperties = {
  ...buttonBase,
  background: '#fff',
  color: '#5f6fff',
  borderColor: '#c7d2fe'
};

const disabledButton: CSSProperties = {
  ...buttonBase,
  background: '#f8fafc',
  color: '#98a2b3',
  borderColor: '#e4e7ec',
  cursor: 'not-allowed'
};

const secondaryDangerButton: CSSProperties = {
  ...buttonBase,
  background: '#fff',
  color: '#c0392b',
  borderColor: 'rgba(192,57,43,0.3)'
};
