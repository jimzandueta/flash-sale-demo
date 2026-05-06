import type { CSSProperties } from 'react';
import type { SessionResponse } from '../api/client';
import { PageShell } from '../components/PageShell';
import { formatUsd, priceForItem } from '../storefrontPricing';
import type { Notice } from '../types';

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
      description="Limited drops with short windows and per-item checkout."
      session={session}
      notice={notice}
    >
      <section style={landingGrid}>
        <section style={dropBoard}>
          <div style={boardHeader}>
            <span style={heroBadge}>Today only</span>
            <h2 style={landingHeadline}>Flash Sale</h2>
            <p style={landingBody}>
              Limited drops open in short windows with fast per-item checkout. Preview the board
              before the next release window opens.
            </p>
          </div>

          <div style={previewList}>
            {previewItems.map((item) => (
              <article key={item.name} style={previewCard}>
                <div style={previewCardHeader}>
                  <p style={previewName}>{item.name}</p>
                  <p style={previewPrice}>{formatUsd(priceForItem(item.name))}</p>
                </div>
                <p style={previewWindowLabel}>Window</p>
                <p style={previewWindowValue}>{item.window}</p>
                <p style={previewBlurb}>{item.blurb}</p>
              </article>
            ))}
          </div>
        </section>

        <form
          style={joinCard}
          onSubmit={(event) => {
            event.preventDefault();
            onSubmit();
          }}
        >
          <div style={joinHeader}>
            <p style={joinEyebrow}>Priority access</p>
            <h2 style={joinTitle}>Join the flash sale</h2>
            <p style={joinBody}>Enter your name to unlock the live drop list.</p>
          </div>

          <label htmlFor="display-name" style={visuallyHidden}>Name</label>
          <input
            id="display-name"
            name="display-name"
            value={draftDisplayName}
            onChange={(event) => onDisplayNameChange(event.target.value)}
            placeholder="Name"
            style={fieldInput}
            disabled={isCreatingSession}
          />

          <label htmlFor="email-address" style={visuallyHidden}>Email Address</label>
          <input
            id="email-address"
            name="email-address"
            type="email"
            placeholder="Email Address"
            style={fieldInput}
            disabled
          />

          <button
            type="submit"
            style={primaryButton}
            disabled={isCreatingSession || draftDisplayName.trim().length === 0}
          >
            {isCreatingSession ? 'Opening the sale...' : 'Enter the sale'}
          </button>

          <p style={helperText}>Use any shopper name to enter the sale floor.</p>
        </form>
      </section>
    </PageShell>
  );
}

const previewItems = [
  {
    name: 'Founder Tee',
    window: '2:00 PM - 2:30 PM',
    blurb: 'Signature release with limited stock.'
  },
  {
    name: 'Bookipi Cap',
    window: '2:00 PM - 2:30 PM',
    blurb: 'Lightweight staple for the first wave.'
  },
  {
    name: 'Bookipi Hoodie',
    window: '2:40 PM - 3:00 PM',
    blurb: 'Heavy fleece layer for the late drop.'
  },
  {
    name: 'Bookipi Tote',
    window: '2:05 PM - 2:25 PM',
    blurb: 'Carry-all canvas piece for quick checkouts.'
  }
] as const;

const landingGrid: CSSProperties = {
  display: 'grid',
  gap: '1rem',
  gridTemplateColumns: 'minmax(0, 1.25fr) minmax(280px, 360px)',
  alignItems: 'stretch'
};

const dropBoard: CSSProperties = {
  display: 'grid',
  gap: '1rem',
  padding: '1rem',
  borderRadius: '0.95rem',
  border: '1px solid rgba(9,90,233,0.12)',
  background: 'linear-gradient(180deg, #ffffff 0%, #f4f8ff 100%)',
  boxShadow: '0 1px 6px rgba(9,90,233,0.06)'
};

const boardHeader: CSSProperties = {
  display: 'grid',
  gap: '0.7rem',
  alignContent: 'start'
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
  fontSize: 'clamp(1.95rem, 4vw, 2.85rem)',
  lineHeight: 0.98,
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

const previewList: CSSProperties = {
  display: 'grid',
  gap: '0.75rem',
  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))'
};

const previewCard: CSSProperties = {
  display: 'grid',
  gap: '0.45rem',
  padding: '0.85rem 0.9rem',
  borderRadius: '0.85rem',
  border: '1px solid rgba(11,25,45,0.08)',
  background: '#ffffff'
};

const previewCardHeader: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'baseline',
  gap: '0.75rem'
};

const previewName: CSSProperties = {
  margin: 0,
  fontSize: '1rem',
  fontWeight: 700,
  color: '#0b192d'
};

const previewPrice: CSSProperties = {
  margin: 0,
  fontSize: '0.95rem',
  fontWeight: 700,
  color: '#095ae9'
};

const previewWindowLabel: CSSProperties = {
  margin: 0,
  fontSize: '0.68rem',
  fontWeight: 700,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: '#6b7280'
};

const previewWindowValue: CSSProperties = {
  margin: 0,
  fontSize: '0.9rem',
  color: '#374151'
};

const previewBlurb: CSSProperties = {
  margin: 0,
  fontSize: '0.86rem',
  lineHeight: 1.45,
  color: '#6b7280'
};

const joinCard: CSSProperties = {
  display: 'grid',
  gap: '0.9rem',
  alignContent: 'start',
  padding: '1rem',
  borderRadius: '0.95rem',
  background: '#ffffff',
  border: '1px solid #e5e7eb',
  boxShadow: '0 1px 6px rgba(9,90,233,0.06)'
};

const joinHeader: CSSProperties = {
  display: 'grid',
  gap: '0.4rem'
};

const joinEyebrow: CSSProperties = {
  margin: 0,
  fontSize: '0.7rem',
  fontWeight: 700,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: '#095ae9'
};

const joinTitle: CSSProperties = {
  margin: 0,
  fontSize: '1.35rem',
  lineHeight: 1.1,
  color: '#0b192d'
};

const joinBody: CSSProperties = {
  margin: 0,
  fontSize: '0.9rem',
  lineHeight: 1.5,
  color: '#6b7280'
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
