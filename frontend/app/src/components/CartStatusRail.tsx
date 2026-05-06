import type { CSSProperties } from 'react';
import { storefrontMeta } from '../storefrontCatalog';
import { formatUsd, storefrontPrice } from '../storefrontPricing';
import { formatRemaining } from '../dateUtils';
import type { CartReservation } from '../types';

type Props = {
  cart: CartReservation[];
  now: number;
  onProceedToCheckout: () => void;
};

export function CartStatusRail({ cart, now, onProceedToCheckout }: Props) {
  const total = cart.reduce(
    (sum, item) => sum + (item.state === 'expired' ? 0 : (storefrontPrice(item.itemName, item.price) ?? 0)),
    0
  );
  const isNarrow = typeof window !== 'undefined' && window.innerWidth <= 960;
  const hasActiveItems = cart.some((item) => item.state !== 'expired');

  return (
    <aside style={rail}>
      <h2 style={railTitle}>Cart</h2>

      <div style={railList}>
        {cart.length > 0 ? (
          cart.map((item) => {
            const price = storefrontPrice(item.itemName, item.price);
            const isExpired = item.state === 'expired' || Date.parse(item.expiresAt) <= now;

            return (
              <div key={item.reservationId} style={isExpired ? expiredRailItem : railItem}>
                <div
                  style={{
                    ...railRow,
                    gridTemplateColumns: isNarrow ? '40px minmax(0, 1fr) 48px' : railRow.gridTemplateColumns
                  }}
                >
                  <div aria-hidden="true" style={{ ...railArt, background: storefrontMeta(item.itemName).gradient }} />
                  <strong style={isExpired ? expiredRailName : railName}>{item.itemName}</strong>
                  <span style={isExpired ? expiredRailPrice : railPrice}>{price === null ? 'n/a' : formatUsd(price)}</span>
                  {!isNarrow ? <span style={isExpired ? expiredRailTime : railTime}>{isExpired ? 'Expired' : formatRemaining(item.expiresAt, now)}</span> : null}
                </div>
              </div>
            );
          })
        ) : (
          <div style={emptyRailState}>
            <span style={emptyRailTitle}>Your cart is empty.</span>
            <span style={emptyRailBody}>Hold an item from the grid to see its timer and total here.</span>
          </div>
        )}
      </div>

      <div style={railSummary}>
        <div style={railTotalRow}>
          <span>Total</span>
          <strong>{formatUsd(total)}</strong>
        </div>
        <button style={primaryRailButton(!hasActiveItems)} disabled={!hasActiveItems} onClick={onProceedToCheckout}>
          Go to checkout
        </button>
      </div>
    </aside>
  );
}

const rail: CSSProperties = {
  display: 'grid',
  gridTemplateRows: 'auto minmax(0, 1fr) auto',
  gap: '12px',
  width: '100%',
  height: '560px',
  boxSizing: 'border-box',
  padding: '20px',
  borderRadius: '24px',
  background: 'linear-gradient(180deg,#eef2ff 0%,#f5f3ff 38%,#ffffff 100%)',
  border: '2px solid rgba(95,111,255,.30)',
  boxShadow: '0 34px 72px rgba(95,111,255,.20), 0 10px 26px rgba(15,23,42,.10)'
};

const railTitle: CSSProperties = {
  margin: 0,
  fontSize: '24px',
  lineHeight: 1.05,
  color: '#101828'
};

const railList: CSSProperties = {
  display: 'grid',
  gap: 0,
  minHeight: 0,
  alignContent: 'start',
  borderRadius: '16px',
  overflow: 'auto',
  border: '1px solid rgba(95,111,255,.18)',
  background: 'rgba(255,255,255,.98)',
  boxShadow: '0 12px 26px rgba(15,23,42,.07)'
};

const railItem: CSSProperties = {
  display: 'grid',
  padding: '10px 12px',
  borderBottom: '1px solid rgba(95,111,255,.12)'
};

const expiredRailItem: CSSProperties = {
  ...railItem,
  background: '#f8fafc'
};

const railRow: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '40px minmax(0, 1fr) 48px 56px',
  gap: '10px',
  alignItems: 'center'
};

const railArt: CSSProperties = {
  width: '40px',
  aspectRatio: '1 / 1',
  borderRadius: '10px',
  border: '1px solid rgba(15,23,42,.08)'
};

const railName: CSSProperties = {
  fontSize: '12px',
  color: '#111827'
};

const railPrice: CSSProperties = {
  fontSize: '11px',
  fontWeight: 700,
  color: '#111827',
  textAlign: 'right'
};

const expiredRailPrice: CSSProperties = {
  ...railPrice,
  color: '#98a2b3'
};

const railTime: CSSProperties = {
  fontSize: '11px',
  fontWeight: 700,
  color: '#c62828',
  textAlign: 'right'
};

const expiredRailTime: CSSProperties = {
  ...railTime,
  color: '#98a2b3'
};

const expiredRailName: CSSProperties = {
  ...railName,
  color: '#98a2b3'
};

const emptyRailState: CSSProperties = {
  display: 'grid',
  gap: '6px',
  padding: '18px',
  alignContent: 'center'
};

const emptyRailTitle: CSSProperties = {
  fontSize: '20px',
  lineHeight: 1.1,
  fontWeight: 700,
  color: '#101828'
};

const emptyRailBody: CSSProperties = {
  color: '#667085',
  fontSize: '13px',
  lineHeight: 1.45
};

const railSummary: CSSProperties = {
  display: 'grid',
  gap: '8px',
  paddingTop: '8px'
};

const railTotalRow: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  fontSize: '13px',
  color: '#475467'
};

function primaryRailButton(disabled: boolean): CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    boxSizing: 'border-box',
    borderRadius: '12px',
    padding: '10px 14px',
    fontWeight: 700,
    fontSize: '13px',
    border: '1px solid transparent',
    cursor: disabled ? 'not-allowed' : 'pointer',
    background: disabled ? '#c7d2fe' : '#5f6fff',
    color: '#ffffff',
    borderColor: disabled ? '#c7d2fe' : '#5f6fff'
  };
}
