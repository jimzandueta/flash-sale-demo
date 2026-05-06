import type { CSSProperties, FormEvent, ReactNode } from 'react';
import type { SaleItem, SessionResponse } from '../api/client';
import { PageShell } from '../components/PageShell';
import { priceForItem, storefrontPrice } from '../storefrontPricing';
import { storefrontMeta } from '../storefrontCatalog';
import { formatWindow } from '../dateUtils';
import type { Notice } from '../types';

type Props = {
  session: SessionResponse | null;
  notice: Notice | null;
  sales: SaleItem[];
  draftDisplayName: string;
  draftEmailAddress: string;
  isCreatingSession: boolean;
  dock?: ReactNode;
  onDisplayNameChange: (value: string) => void;
  onEmailAddressChange: (value: string) => void;
  onSubmit: () => void;
};

export function LandingPage({
  session,
  notice,
  sales,
  draftDisplayName,
  draftEmailAddress,
  isCreatingSession,
  dock,
  onDisplayNameChange,
  onEmailAddressChange,
  onSubmit
}: Props) {
  const activeSales = sales.filter((sale) => sale.status === 'active');
  const isSubmitDisabled =
    isCreatingSession || draftDisplayName.trim().length === 0 || draftEmailAddress.trim().length === 0;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit();
  }

  return (
    <PageShell
      header={{
        eyebrow: 'KooPiBi / Flash Sale',
        headline: 'Limited drops. Short windows. Shop the sale before it is gone.'
      }}
      notice={notice}
      dock={dock}
    >
      <section style={landingGrid}>
        <div style={heroCard}>
          <div style={landingBand}>
            <span style={dropKicker}>Spring drop live now</span>
            <h2 style={heroTitle}>Flash Sale</h2>
            <p style={heroBody}>Limited-run KooPiBi pieces with short sale windows and high-demand inventory.</p>
          </div>

          <div style={dropGrid}>
            {activeSales.length > 0 ? (
              activeSales.map((sale) => (
                <div key={sale.saleId} style={dropTile}>
                  <div style={dropTagRow}>
                    <span style={dropStatus()}>Live</span>
                    <span style={dropWindow}>{formatWindow(sale.startsAt, sale.endsAt)}</span>
                  </div>

                  <div style={dropBody}>
                    <div aria-hidden="true" style={{ ...dropArt, background: storefrontMeta(sale.itemName).gradient }} />
                    <div style={dropCopy}>
                      <div style={dropNameRow}>
                        <span style={dropName}>{sale.itemName}</span>
                        <span style={dropPrice}>{formatLandingPrice(sale)}</span>
                      </div>
                      <span style={dropMeta}>{productCopy(sale.itemName)}</span>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div style={emptyLandingState}>
                <span style={emptyLandingTitle}>No active drops right now.</span>
                <span style={emptyLandingCopy}>Check back soon for the next live sale window.</span>
              </div>
            )}
          </div>
        </div>

        <form style={landingPanel} onSubmit={handleSubmit}>
          <div style={landingJoinCopy}>
            <span style={joinTitle}>Join the flash sale</span>
            <span style={landingHelper}>
              Enter now to shop the current drop before the window closes. Supply your name and email address.
            </span>
          </div>

          <div style={landingFields}>
            <label htmlFor="display-name" style={visuallyHidden}>Name</label>
            <input
              id="display-name"
              name="display-name"
              value={draftDisplayName}
              onChange={(event) => onDisplayNameChange(event.target.value)}
              placeholder="Name"
              style={landingInput}
              disabled={isCreatingSession}
            />

            <label htmlFor="email-address" style={visuallyHidden}>Email Address</label>
            <input
              id="email-address"
              name="email-address"
              type="email"
              value={draftEmailAddress}
              onChange={(event) => onEmailAddressChange(event.target.value)}
              placeholder="Email"
              style={landingInput}
              disabled={isCreatingSession}
            />
          </div>

          <div style={buttonRow}>
            <button
              type="submit"
              style={landingButtonStyle(isSubmitDisabled)}
              disabled={isSubmitDisabled}
            >
              {isCreatingSession ? 'Opening the sale...' : 'Enter the sale'}
            </button>
          </div>
        </form>
      </section>
    </PageShell>
  );
}

function formatLandingPrice(sale: SaleItem) {
  const price = storefrontPrice(sale.itemName, sale.price);
  return price === null ? 'Price unavailable' : `$${price}`;
}

function productCopy(itemName: string) {
  if (itemName === 'KooPiBi Cap') return 'Embroidered cap in the current drop.';
  if (itemName === 'Founder Tee') return 'Heavyweight tee from the founder collection.';
  if (itemName === 'KooPiBi Tote') return 'Everyday canvas tote with limited stock.';
  if (itemName === 'KooPiBi Hoodie') return 'Midweight fleece hoodie in the next release.';
  return 'Limited-run item from the flash sale.';
}

const landingGrid: CSSProperties = {
  display: 'grid',
  gap: '16px',
  gridTemplateColumns: '1.05fr 0.95fr'
};

const heroCard: CSSProperties = {
  background: 'linear-gradient(145deg, #101828 0%, #1d2939 55%, #374151 100%)',
  color: '#ffffff',
  borderRadius: '18px',
  padding: '18px',
  display: 'grid',
  gap: '12px'
};

const landingBand: CSSProperties = {
  display: 'grid',
  gap: '6px'
};

const dropKicker: CSSProperties = {
  fontSize: '11px',
  fontWeight: 700,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: '#c7d2fe'
};

const heroTitle: CSSProperties = {
  margin: 0,
  fontSize: '40px',
  lineHeight: 0.95
};

const heroBody: CSSProperties = {
  margin: 0,
  color: '#d0d5dd',
  fontSize: '15px',
  lineHeight: 1.4,
  maxWidth: '34rem'
};

const dropGrid: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: '12px'
};

const emptyLandingState: CSSProperties = {
  display: 'grid',
  gap: '6px',
  padding: '18px',
  borderRadius: '16px',
  background: 'rgba(255,255,255,0.07)',
  border: '1px solid rgba(255,255,255,0.12)',
  minHeight: '132px',
  alignContent: 'center',
  gridColumn: '1 / -1'
};

const emptyLandingTitle: CSSProperties = {
  fontSize: '20px',
  lineHeight: 1.1,
  fontWeight: 700,
  color: '#ffffff'
};

const emptyLandingCopy: CSSProperties = {
  color: '#cbd5e1',
  fontSize: '13px',
  lineHeight: 1.45
};

const dropTile: CSSProperties = {
  display: 'grid',
  gap: '10px',
  padding: '14px',
  borderRadius: '16px',
  background: 'rgba(255,255,255,0.07)',
  border: '1px solid rgba(255,255,255,0.12)',
  minHeight: '132px'
};

const dropTagRow: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: '10px',
  alignItems: 'center',
  flexWrap: 'wrap'
};

function dropStatus(color?: string): CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    fontSize: '11px',
    fontWeight: 700,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: color ?? '#d1fae5'
  };
}

const dropWindow: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  fontSize: '11px',
  fontWeight: 700,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: '#c7d2fe'
};

const dropBody: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '68px minmax(0, 1fr)',
  gap: '12px',
  alignItems: 'center'
};

const dropArt: CSSProperties = {
  width: '68px',
  aspectRatio: '1 / 1',
  borderRadius: '14px',
  border: '1px solid rgba(255,255,255,0.10)'
};

const dropCopy: CSSProperties = {
  display: 'grid',
  gap: '6px',
  alignContent: 'center'
};

const dropNameRow: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: '8px',
  alignItems: 'baseline',
  flexWrap: 'wrap'
};

const dropName: CSSProperties = {
  fontSize: '24px',
  lineHeight: 1,
  fontWeight: 700,
  color: '#ffffff'
};

const dropPrice: CSSProperties = {
  fontSize: '14px',
  lineHeight: 1.2,
  fontWeight: 700,
  color: '#ffffff'
};

const dropMeta: CSSProperties = {
  color: '#cbd5e1',
  fontSize: '13px',
  lineHeight: 1.45
};

const landingPanel: CSSProperties = {
  alignContent: 'start',
  display: 'grid',
  gap: '16px',
  position: 'relative',
  overflow: 'hidden',
  background: 'linear-gradient(180deg, #ffffff 0%, #f5f3ff 100%)',
  border: '2px solid rgba(95, 111, 255, 0.32)',
  boxShadow: '0 24px 48px rgba(95, 111, 255, 0.16)',
  borderRadius: '18px',
  padding: '18px'
};

const landingJoinCopy: CSSProperties = {
  position: 'relative',
  zIndex: 1,
  display: 'grid',
  gap: '10px'
};

const joinTitle: CSSProperties = {
  fontSize: '28px',
  fontWeight: 700,
  color: '#111827',
  lineHeight: 1,
  whiteSpace: 'nowrap'
};

const landingHelper: CSSProperties = {
  color: '#667085',
  fontSize: '12px',
  lineHeight: 1.35,
  position: 'relative',
  zIndex: 1
};

const landingFields: CSSProperties = {
  display: 'grid',
  gap: '8px',
  position: 'relative',
  zIndex: 1
};

const visuallyHidden: CSSProperties = {
  position: 'absolute',
  width: '1px',
  height: '1px',
  padding: 0,
  margin: '-1px',
  overflow: 'hidden',
  clip: 'rect(0, 0, 0, 0)',
  whiteSpace: 'nowrap',
  border: 0
};

const landingInput: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  minHeight: '54px',
  borderRadius: '14px',
  border: '1px solid rgba(95,111,255,0.18)',
  background: '#ffffff',
  padding: '0 14px',
  color: '#101828',
  fontWeight: 500,
  position: 'relative',
  zIndex: 1,
  boxSizing: 'border-box',
  width: '100%'
};

const buttonRow: CSSProperties = {
  display: 'grid',
  position: 'relative',
  zIndex: 1
};

function landingButtonStyle(isDisabled: boolean): CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    minHeight: '48px',
    borderRadius: '12px',
    background: isDisabled
      ? 'linear-gradient(180deg, #c7d2fe 0%, #a5b4fc 100%)'
      : 'linear-gradient(180deg, #6f7cff 0%, #5f6fff 100%)',
    color: 'rgba(255,255,255,0.92)',
    fontWeight: 700,
    fontSize: '13px',
    opacity: isDisabled ? 0.75 : 1,
    boxShadow: isDisabled
      ? 'inset 0 1px 0 rgba(255,255,255,0.28)'
      : '0 8px 18px rgba(95,111,255,0.28)',
    border: 'none',
    cursor: isDisabled ? 'not-allowed' : 'pointer'
  };
}
