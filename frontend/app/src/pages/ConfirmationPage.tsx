import type { CSSProperties, ReactNode } from 'react';
import type { SessionResponse } from '../api/client';
import { PageShell } from '../components/PageShell';
import { formatUsd, storefrontPrice } from '../storefrontPricing';
import { formatDateTime } from '../dateUtils';
import type { Notice, PurchaseSummary } from '../types';

type Props = {
  session: SessionResponse | null;
  notice: Notice | null;
  purchases: PurchaseSummary[];
  dock?: ReactNode;
  onBack: () => void;
};

export function ConfirmationPage({ session, notice, purchases, dock, onBack }: Props) {
  return (
    <PageShell
      header={{
        eyebrow: 'Confirmation',
        headline: 'Order confirmed',
        supportingCopy: 'Purchased items remain available here as a receipt view.',
        chip: session ? { label: 'Session', value: session.displayName } : undefined
      }}
      notice={notice}
      dock={dock}
    >
      <section style={centerLayout}>
        <div style={receiptCard}>
          <span style={successBadge}>✓ Payment cleared</span>
          <h2 style={receiptTitle}>Your order is confirmed</h2>

          {purchases.map((purchase) => (
            <div key={purchase.reservationId} style={purchaseRow}>
              <div>
                <p style={purchaseName}>{purchase.itemName}</p>
                <p style={purchaseMeta}>{formatPrice(purchase)}</p>
                <p style={purchaseMeta}>Purchased at {formatDateTime(purchase.purchasedAt)}</p>
                <p style={purchaseMeta}>{purchase.reservationId}</p>
              </div>
              <span style={checkBadge}>✓</span>
            </div>
          ))}

          <div style={{ marginTop: '1rem' }}>
            <button style={backButton} onClick={onBack}>← Back to products</button>
          </div>
        </div>
      </section>
    </PageShell>
  );
}

function formatPrice(purchase: PurchaseSummary) {
  const price = storefrontPrice(purchase.itemName, purchase.price);
  return price === null ? 'Price unavailable' : formatUsd(price);
}

const centerLayout: CSSProperties = { display: 'grid', justifyItems: 'center' };

const receiptCard: CSSProperties = {
  display: 'grid',
  gap: '0.75rem',
  width: 'min(100%, 680px)',
  padding: '1.15rem',
  borderRadius: '0.875rem',
  background: '#ffffff',
  border: '1px solid #e5e7eb',
  boxShadow: '0 1px 6px rgba(9,90,233,0.06)'
};

const receiptTitle: CSSProperties = {
  margin: 0,
  fontSize: 'clamp(1.35rem, 3vw, 1.9rem)',
  lineHeight: 1.05,
  fontWeight: 700,
  color: '#0b192d'
};

const successBadge: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  alignSelf: 'start',
  padding: '0.25rem 0.65rem',
  borderRadius: '999px',
  background: '#dcfce7',
  color: '#166534',
  fontSize: '0.72rem',
  fontWeight: 700,
  letterSpacing: '0.06em',
  textTransform: 'uppercase'
};

const purchaseRow: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '1rem',
  padding: '0.75rem 0.85rem',
  borderRadius: '0.75rem',
  background: 'rgba(34,197,94,0.06)',
  border: '1px solid rgba(34,197,94,0.1)'
};

const purchaseName: CSSProperties = { margin: 0, fontWeight: 700, fontSize: '0.9rem', color: '#0b192d' };
const purchaseMeta: CSSProperties = { margin: '0.1rem 0 0', fontSize: '0.75rem', color: '#6b7280' };

const checkBadge: CSSProperties = {
  width: '1.4rem',
  height: '1.4rem',
  background: '#dcfce7',
  borderRadius: '999px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: '0.75rem',
  color: '#166534',
  flexShrink: 0
};

const backButton: CSSProperties = {
  background: '#ffffff',
  border: '1px solid #e5e7eb',
  color: '#374151',
  borderRadius: '0.5rem',
  padding: '0.5rem 0.9rem',
  fontSize: '0.82rem',
  fontWeight: 600,
  cursor: 'pointer'
};
