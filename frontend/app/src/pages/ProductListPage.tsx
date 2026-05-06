import type { CSSProperties, ReactNode } from 'react';
import type { SaleItem, SessionResponse } from '../api/client';
import { PageShell } from '../components/PageShell';
import { formatUsd, storefrontPrice } from '../storefrontPricing';
import { storefrontMeta } from '../storefrontCatalog';
import { formatRemaining, formatWindow } from '../dateUtils';
import type { CartReservation, Notice } from '../types';

type Props = {
  session: SessionResponse | null;
  notice: Notice | null;
  sales: SaleItem[];
  cart: CartReservation[];
  cartRailItems?: CartReservation[];
  purchasedSaleIds: Set<string>;
  isLoadingCatalog: boolean;
  now: number;
  dock?: ReactNode;
  onViewProduct: (saleId: string) => void;
  onProceedToCheckout: () => void;
};

type CardState = 'ending' | 'live' | 'soon' | 'ended' | 'purchased';

export function ProductListPage({
  notice,
  sales,
  cart,
  cartRailItems,
  purchasedSaleIds,
  isLoadingCatalog,
  now,
  dock,
  onViewProduct,
  onProceedToCheckout
}: Props) {
  const isNarrow = typeof window !== 'undefined' && window.innerWidth <= 960;
  const railItems = cartRailItems ?? cart;
  const total = railItems.reduce(
    (sum, item) => sum + (item.state === 'expired' ? 0 : (storefrontPrice(item.itemName, item.price) ?? 0)),
    0
  );
  const hasActiveItems = railItems.some((item) => item.state !== 'expired');
  const orderedSales = [...sales].sort((a, b) => compareProductListSales(a, b, now));

  return (
    <PageShell
      header={{
        eyebrow: 'KooPiBi / Flash Sale / Products',
        headline: 'Products',
        supportingCopy: 'Limited drops with short sale windows.'
      }}
      notice={notice}
      dock={dock}
    >
      {isLoadingCatalog ? (
        <section style={loadingCard}>
          <p style={loadingText}>Syncing the product board...</p>
        </section>
      ) : (
        <section
          style={{
            ...layout,
            gridTemplateColumns: isNarrow ? '1fr' : layout.gridTemplateColumns
          }}
        >
          <div
            style={{
              ...catalogGrid,
              gridTemplateColumns: isNarrow ? '1fr' : catalogGrid.gridTemplateColumns
            }}
          >
            {orderedSales.map((sale) => {
              const cartItem = cart.find((item) => item.saleId === sale.saleId) ?? null;
              const isPurchased = purchasedSaleIds.has(sale.saleId);
              const isUrgentLiveSale = sale.status === 'active' && isWithinUrgentWindow(sale.endsAt, now);
              const state: CardState = cartItem
                ? 'ending'
                : isPurchased
                  ? 'purchased'
                  : isUrgentLiveSale
                    ? 'ending'
                    : sale.status === 'ended'
                      ? 'ended'
                      : sale.status === 'upcoming'
                        ? 'soon'
                        : 'live';
              const labelState: 'live' | 'soon' | 'ended' = state === 'soon' ? 'soon' : state === 'ended' ? 'ended' : 'live';
              const price = storefrontPrice(sale.itemName, sale.price);

              return (
                <article key={sale.saleId} style={catalogCardStyle(state)}>
                  {isPurchased ? <span style={purchasedBanner}>✓ Already purchased</span> : null}

                  <div style={cardHead}>
                    {cartItem ? (
                      <span style={holdPill}>{`Held ${formatRemaining(cartItem.expiresAt, now)} left`}</span>
                    ) : isPurchased ? (
                      <span style={cardLabel('live')}>Purchased</span>
                    ) : (
                      <span style={cardLabel(labelState)}>{labelState === 'live' ? 'Live' : labelState === 'soon' ? 'Soon' : 'Ended'}</span>
                    )}
                    <span style={cardTime(state)}>{formatWindow(sale.startsAt, sale.endsAt)}</span>
                  </div>

                  <div style={cardRow}>
                    <div aria-hidden="true" style={{ ...cardArt, background: storefrontMeta(sale.itemName).gradient }} />
                    <div style={cardCopy}>
                      <div style={titlePriceRow}>
                        <span style={cardTitle(state)}>{storefrontMeta(sale.itemName).displayName}</span>
                        <span style={cardPrice(state)}>{price === null ? 'Price unavailable' : formatUsd(price)}</span>
                      </div>
                      <span style={cardBody(state)}>{storefrontMeta(sale.itemName).blurb}</span>
                    </div>
                  </div>

                  <div style={cardFoot}>
                    <span style={footText(state)}>
                      {state === 'soon'
                        ? 'Starts soon'
                        : state === 'purchased'
                          ? 'Purchased'
                        : state === 'ended'
                          ? 'Window ended'
                          : formatSaleTimeRemaining(sale.endsAt, now)}
                    </span>
                    <button
                      style={cardButtonStyle(state)}
                      disabled={state === 'ended'}
                      onClick={state === 'ended' ? undefined : () => onViewProduct(sale.saleId)}
                    >
                      {state === 'soon' ? 'Remind me' : state === 'ended' ? 'Ended' : 'View product'}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>

          <aside style={cartRail}>
            <span style={railKicker}>Cart</span>
            <div style={railList}>
              {railItems.length > 0 ? (
                railItems.map((item) => {
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
        </section>
      )}
    </PageShell>
  );
}

function formatSaleTimeRemaining(endsAt: string, now: number) {
  const ms = Date.parse(endsAt) - now;
  if (ms <= 0) return 'Window ended';

  const totalMinutes = Math.ceil(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours > 0 && minutes > 0) return `${hours}h ${minutes}m left`;
  if (hours > 0) return `${hours}h left`;
  return `${minutes}m left`;
}

function isWithinUrgentWindow(endsAt: string, now: number) {
  const msRemaining = Date.parse(endsAt) - now;
  return msRemaining > 0 && msRemaining <= 45 * 60 * 1000;
}

function compareProductListSales(a: SaleItem, b: SaleItem, now: number) {
  const rank: Record<SaleItem['status'], number> = { active: 0, upcoming: 1, ended: 2 };
  const statusDelta = rank[a.status] - rank[b.status];
  if (statusDelta !== 0) return statusDelta;

  if (a.status === 'active') {
    return Date.parse(a.endsAt) - Date.parse(b.endsAt);
  }

  if (a.status === 'upcoming') {
    return Date.parse(a.startsAt) - Date.parse(b.startsAt);
  }

  const endedDelta = Date.parse(b.endsAt) - Date.parse(a.endsAt);
  if (endedDelta !== 0) return endedDelta;

  return Math.abs(Date.parse(a.endsAt) - now) - Math.abs(Date.parse(b.endsAt) - now);
}

function catalogCardStyle(state: CardState): CSSProperties {
  const base: CSSProperties = {
    display: 'grid',
    gap: '8px',
    padding: '14px',
    borderRadius: '18px',
    border: '1px solid rgba(95,111,255,.14)',
    boxShadow: '0 18px 36px rgba(95,111,255,.08)',
    background: 'linear-gradient(180deg,#ffffff 0%,#f8faff 100%)',
    minHeight: '184px'
  };

  if (state === 'ending') {
    return {
      ...base,
      background: 'linear-gradient(180deg,#ffebee 0%,#ffffff 100%)',
      border: '2px solid #ef5350',
      boxShadow: '0 14px 30px rgba(239,83,80,.12)'
    };
  }

  if (state === 'ended') {
    return {
      ...base,
      background: 'linear-gradient(180deg,#f5f5f5 0%,#ffffff 100%)',
      border: '1px solid #d5d9e3',
      boxShadow: '0 12px 24px rgba(15,23,42,.04)'
    };
  }

  if (state === 'purchased') {
    return {
      ...base,
      background: 'linear-gradient(180deg,#f4f9ff 0%,#ffffff 100%)',
      border: '1px solid rgba(9,90,233,.18)',
      boxShadow: '0 14px 28px rgba(9,90,233,.08)'
    };
  }

  return base;
}

function cardLabel(state: 'live' | 'soon' | 'ended'): CSSProperties {
  return {
    fontSize: '11px',
    fontWeight: 700,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: state === 'ended' ? '#757575' : '#5f6fff'
  };
}

function cardTime(state: CardState): CSSProperties {
  return {
    fontSize: '11px',
    fontWeight: 700,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: state === 'ending' ? '#c62828' : state === 'purchased' ? '#095ae9' : '#5b6cb2'
  };
}

function cardTitle(state: CardState): CSSProperties {
  return {
    fontSize: '20px',
    fontWeight: 700,
    lineHeight: 1.05,
    color: state === 'ending' ? '#c62828' : '#111827'
  };
}

function cardPrice(state: CardState): CSSProperties {
  return {
    fontSize: '18px',
    fontWeight: 700,
    lineHeight: 1,
    color: state === 'ending' ? '#c62828' : state === 'ended' ? '#757575' : state === 'purchased' ? '#095ae9' : '#111827'
  };
}

function cardBody(state: CardState): CSSProperties {
  return {
    color: state === 'ending' ? '#b71c1c' : state === 'purchased' ? '#475467' : '#667085',
    fontSize: '13px',
    lineHeight: 1.45
  };
}

function footText(state: CardState): CSSProperties {
  return {
    color: state === 'ending' ? '#b71c1c' : state === 'purchased' ? '#095ae9' : '#667085',
    fontSize: '13px',
    lineHeight: 1.45
  };
}

function cardButtonStyle(state: CardState): CSSProperties {
  const base: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '12px',
    padding: '10px 14px',
    fontWeight: 700,
    fontSize: '13px',
    border: '1px solid transparent',
    width: 'fit-content',
    cursor: state === 'ended' ? 'not-allowed' : 'pointer'
  };

  if (state === 'ending') {
    return {
      ...base,
      background: '#d32f2f',
      color: '#ffffff',
      borderColor: '#d32f2f'
    };
  }

  if (state === 'soon') {
    return {
      ...base,
      background: '#ffffff',
      color: '#5f6fff',
      borderColor: '#c7d2fe'
    };
  }

  if (state === 'ended') {
    return {
      ...base,
      background: '#e0e0e0',
      color: '#9e9e9e',
      borderColor: '#d5d5d5'
    };
  }

  if (state === 'purchased') {
    return {
      ...base,
      background: '#ffffff',
      color: '#095ae9',
      borderColor: '#bcd7ff'
    };
  }

  return {
    ...base,
    background: '#5f6fff',
    color: '#ffffff',
    borderColor: '#5f6fff'
  };
}

function primaryRailButton(disabled: boolean): CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '12px',
    padding: '10px 14px',
    fontWeight: 700,
    fontSize: '13px',
    border: '1px solid #5f6fff',
    background: disabled ? '#c7cbe6' : '#5f6fff',
    color: '#ffffff',
    cursor: disabled ? 'not-allowed' : 'pointer'
  };
}

const layout: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr) 372px',
  gap: '18px',
  alignItems: 'start'
};

const catalogGrid: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: '14px'
};

const loadingCard: CSSProperties = {
  display: 'grid',
  gap: '10px',
  padding: '14px',
  borderRadius: '18px',
  border: '1px solid rgba(95,111,255,.14)',
  background: 'linear-gradient(180deg,#ffffff 0%,#f8faff 100%)'
};

const loadingText: CSSProperties = {
  margin: 0,
  color: '#667085',
  lineHeight: 1.45
};

const cardHead: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: '10px',
  flexWrap: 'wrap'
};

const holdPill: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: '999px',
  padding: '6px 10px',
  background: '#ffebee',
  color: '#c62828',
  fontSize: '11px',
  fontWeight: 700,
  letterSpacing: '0.08em',
  textTransform: 'uppercase'
};

const purchasedBanner: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  alignSelf: 'start',
  padding: '6px 10px',
  borderRadius: '999px',
  background: '#e0f0ff',
  color: '#095ae9',
  fontSize: '11px',
  fontWeight: 700,
  letterSpacing: '0.08em',
  textTransform: 'uppercase'
};

const cardRow: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '72px minmax(0, 1fr)',
  gap: '12px',
  alignItems: 'center'
};

const cardArt: CSSProperties = {
  width: '72px',
  aspectRatio: '1 / 1',
  borderRadius: '16px',
  border: '1px solid rgba(15,23,42,.08)'
};

const cardCopy: CSSProperties = {
  display: 'grid',
  gap: '4px'
};

const titlePriceRow: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'baseline',
  gap: '10px',
  flexWrap: 'wrap'
};

const cardFoot: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: '8px',
  flexWrap: 'wrap',
  marginTop: 'auto'
};

const cartRail: CSSProperties = {
  display: 'grid',
  gridTemplateRows: 'auto minmax(0, 1fr) auto',
  gap: '12px',
  width: '100%',
  height: '520px',
  justifySelf: 'end',
  boxSizing: 'border-box',
  padding: '20px',
  borderRadius: '24px',
  background: 'linear-gradient(180deg,#eef2ff 0%,#f5f3ff 38%,#ffffff 100%)',
  border: '2px solid rgba(95,111,255,.30)',
  boxShadow: '0 34px 72px rgba(95,111,255,.20), 0 10px 26px rgba(15,23,42,.10)'
};

const railKicker: CSSProperties = {
  fontSize: '11px',
  fontWeight: 700,
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
  color: '#4f46e5'
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
  gridTemplateColumns: '40px minmax(0,1fr) 48px 56px',
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

const emptyRailState: CSSProperties = {
  display: 'grid',
  gap: '6px',
  padding: '16px'
};

const emptyRailTitle: CSSProperties = {
  fontSize: '16px',
  fontWeight: 700,
  color: '#111827'
};

const emptyRailBody: CSSProperties = {
  fontSize: '13px',
  lineHeight: 1.45,
  color: '#667085'
};
