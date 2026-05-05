import type { CSSProperties } from 'react';
import type { SessionResponse } from '../api/client';
import { PageShell } from '../components/PageShell';
import { flow, pageLabels, type Notice } from '../types';

type Props = {
  session: SessionResponse | null;
  notice: Notice | null;
  draftDisplayName: string;
  isCreatingSession: boolean;
  onDisplayNameChange: (value: string) => void;
  onSubmit: () => void;
};

export function LandingPage({
  session,
  notice,
  draftDisplayName,
  isCreatingSession,
  onDisplayNameChange,
  onSubmit
}: Props) {
  return (
    <PageShell
      page="landing"
      title="Flash Sale"
      description="Enter the sale floor, hold items, and checkout before the timer runs out."
      session={session}
      notice={notice}
    >
      <section style={landingGrid}>
        <div style={landingCopy}>
          <span style={heroBadge}>Five-minute holds. Per-item checkout. No oversell.</span>
          <h2 style={landingHeadline}>A proper storefront flow for flash drops.</h2>
          <p style={landingBody}>
            Browse active sales, add items to your cart, and check out each hold individually
            before it expires.
          </p>
          <div style={previewRail}>
            {flow.slice(1).map((step) => (
              <div key={step} style={previewChip}>{pageLabels[step]}</div>
            ))}
          </div>
        </div>

        <form
          style={heroCard}
          onSubmit={(event) => {
            event.preventDefault();
            onSubmit();
          }}
        >
          <label htmlFor="display-name" style={fieldLabel}>Your name</label>
          <input
            id="display-name"
            name="display-name"
            value={draftDisplayName}
            onChange={(event) => onDisplayNameChange(event.target.value)}
            placeholder="Jim"
            style={fieldInput}
            disabled={isCreatingSession}
          />
          <button
            type="submit"
            style={primaryButton}
            disabled={isCreatingSession || draftDisplayName.trim().length === 0}
          >
            {isCreatingSession ? 'Opening catalog...' : 'Start shopping'}
          </button>
          <p style={helperText}>Anonymous sessions. No account needed.</p>
        </form>
      </section>
    </PageShell>
  );
}

const landingGrid: CSSProperties = {
  display: 'grid',
  gap: '1rem',
  gridTemplateColumns: 'minmax(0, 1.1fr) minmax(300px, 380px)',
  alignItems: 'stretch'
};

const landingCopy: CSSProperties = {
  display: 'grid',
  gap: '0.75rem',
  alignContent: 'start',
  padding: '0.35rem 0.15rem'
};

const heroBadge: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  alignSelf: 'start',
  padding: '0.4rem 0.75rem',
  borderRadius: '999px',
  border: '1px solid rgba(9,90,233,0.18)',
  background: '#e0f0ff',
  color: '#095ae9',
  fontSize: '0.7rem',
  fontWeight: 700,
  letterSpacing: '0.06em',
  textTransform: 'uppercase'
};

const landingHeadline: CSSProperties = {
  margin: 0,
  fontSize: 'clamp(1.8rem, 4vw, 2.8rem)',
  lineHeight: 1.02,
  fontWeight: 700,
  color: '#0b192d'
};

const landingBody: CSSProperties = {
  margin: 0,
  maxWidth: '38rem',
  lineHeight: 1.6,
  color: '#374151',
  fontSize: '0.95rem'
};

const previewRail: CSSProperties = { display: 'flex', flexWrap: 'wrap', gap: '0.4rem' };

const previewChip: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: '1.75rem',
  padding: '0.25rem 0.55rem',
  borderRadius: '999px',
  border: '1px solid #e5e7eb',
  background: '#ffffff',
  color: '#6b7280',
  fontSize: '0.65rem',
  fontWeight: 700,
  letterSpacing: '0.06em',
  textTransform: 'uppercase'
};

const heroCard: CSSProperties = {
  display: 'grid',
  gap: '0.9rem',
  padding: '1rem',
  borderRadius: '0.875rem',
  background: '#ffffff',
  border: '1px solid #e5e7eb',
  boxShadow: '0 1px 6px rgba(9,90,233,0.06)'
};

const fieldLabel: CSSProperties = { fontWeight: 700, color: '#0b192d' };

const fieldInput: CSSProperties = {
  width: '100%',
  padding: '0.95rem 1rem',
  borderRadius: '0.5rem',
  border: '1px solid #e5e7eb',
  background: '#ffffff',
  fontSize: '1rem',
  color: '#0b192d',
  boxSizing: 'border-box'
};

const helperText: CSSProperties = {
  margin: 0,
  fontSize: '0.82rem',
  color: '#6b7280',
  lineHeight: 1.5
};

const primaryButton: CSSProperties = {
  border: 'none',
  borderRadius: '0.5rem',
  padding: '0.75rem 1rem',
  fontWeight: 700,
  fontSize: '0.88rem',
  cursor: 'pointer',
  background: '#095ae9',
  color: '#ffffff'
};
