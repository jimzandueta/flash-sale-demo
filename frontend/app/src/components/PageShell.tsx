import type { CSSProperties, ReactNode } from 'react';
import type { SessionResponse } from '../api/client';
import { flow, pageLabels, type Notice, type Page } from '../types';

type Props = {
  page: Page;
  title: string;
  description: string;
  session: SessionResponse | null;
  notice: Notice | null;
  children: ReactNode;
  aside?: ReactNode;
};

export function PageShell({ page, title, description, session, notice, children, aside }: Props) {
  return (
    <main style={shell}>
      <section style={frame}>
        <header style={masthead}>
          <div>
            <p style={brandMark}>Bookipi / Flash Sale</p>
            <p style={pageKicker}>{pageLabels[page]}</p>
            <h1 style={pageTitle}>{title}</h1>
            <p style={pageDescription}>{description}</p>
          </div>

          <div style={mastheadSide}>
            <nav aria-label="Experience steps" style={flowRail}>
              {flow.map((step) => (
                <span key={step} style={stepChip(step, page)}>
                  {pageLabels[step]}
                </span>
              ))}
            </nav>

            {session ? (
              <div style={sessionCard}>
                <span style={sessionLabel}>Signed in as</span>
                <strong style={sessionValue}>{session.displayName}</strong>
                <span style={tokenText}>{session.userToken}</span>
              </div>
            ) : null}

            {aside}
          </div>
        </header>

        {notice ? <p style={noticeStyle(notice.tone)}>{notice.text}</p> : null}

        {children}
      </section>
    </main>
  );
}

function stepChip(step: Page, currentPage: Page): CSSProperties {
  const currentIndex = flow.indexOf(currentPage);
  const stepIndex = flow.indexOf(step);
  const isActive = step === currentPage;
  const isComplete = stepIndex < currentIndex;

  return {
    ...baseChip,
    background: isActive ? '#095ae9' : isComplete ? '#e0f0ff' : '#ffffff',
    color: isActive ? '#ffffff' : isComplete ? '#095ae9' : '#6b7280',
    borderColor: isActive ? '#095ae9' : isComplete ? 'rgba(9,90,233,0.2)' : '#e5e7eb'
  };
}

function noticeStyle(tone: Notice['tone']): CSSProperties {
  return {
    ...noticeBase,
    background:
      tone === 'success' ? '#dcfce7' :
      tone === 'warning' ? 'rgba(192,57,43,0.08)' :
      '#e0f0ff',
    color:
      tone === 'success' ? '#166534' :
      tone === 'warning' ? '#c0392b' :
      '#095ae9',
    borderColor:
      tone === 'success' ? '#bbf7d0' :
      tone === 'warning' ? 'rgba(192,57,43,0.2)' :
      'rgba(9,90,233,0.18)'
  };
}

const baseChip: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: '1.75rem',
  padding: '0.25rem 0.55rem',
  borderRadius: '999px',
  border: '1px solid',
  fontSize: '0.65rem',
  fontWeight: 700,
  letterSpacing: '0.06em',
  textTransform: 'uppercase'
};

const shell: CSSProperties = {
  position: 'relative',
  minHeight: '100vh',
  padding: 'clamp(0.85rem, 2vw, 1.5rem)',
  background: '#f8faff',
  fontFamily: 'Avenir Next, Gill Sans, sans-serif'
};

const frame: CSSProperties = {
  position: 'relative',
  display: 'grid',
  gap: '0.8rem',
  maxWidth: '1100px',
  margin: '0 auto',
  padding: '0.95rem',
  borderRadius: '1rem',
  background: 'rgba(248, 250, 255, 0.88)',
  border: '1px solid #e5e7eb',
  boxShadow: '0 8px 28px rgba(9, 90, 233, 0.06)'
};

const masthead: CSSProperties = {
  display: 'grid',
  gap: '0.75rem',
  gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
  alignItems: 'start'
};

const mastheadSide: CSSProperties = { display: 'grid', gap: '0.75rem' };

const brandMark: CSSProperties = {
  margin: 0,
  fontSize: '0.7rem',
  letterSpacing: '0.18em',
  textTransform: 'uppercase',
  color: '#095ae9',
  fontWeight: 700
};

const pageKicker: CSSProperties = {
  margin: '0.2rem 0 0',
  fontSize: '0.72rem',
  fontWeight: 700,
  letterSpacing: '0.09em',
  textTransform: 'uppercase',
  color: '#6b7280'
};

const pageTitle: CSSProperties = {
  margin: '0.2rem 0 0',
  fontFamily: 'Avenir Next, Gill Sans, sans-serif',
  fontSize: 'clamp(1.15rem, 2.3vw, 1.5rem)',
  lineHeight: 1.05,
  fontWeight: 700,
  color: '#0b192d'
};

const pageDescription: CSSProperties = {
  margin: 0,
  maxWidth: '34rem',
  color: '#374151',
  lineHeight: 1.45,
  fontSize: '0.86rem'
};

const flowRail: CSSProperties = { display: 'flex', flexWrap: 'wrap', gap: '0.35rem', justifyContent: 'flex-end' };

const sessionCard: CSSProperties = {
  display: 'grid',
  gap: '0.2rem',
  padding: '0.8rem 0.95rem',
  borderRadius: '0.875rem',
  background: '#ffffff',
  border: '1px solid #e5e7eb',
  boxShadow: '0 1px 6px rgba(9,90,233,0.06)',
  minWidth: '240px',
  justifySelf: 'end'
};

const sessionLabel: CSSProperties = {
  fontSize: '0.68rem',
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
  color: '#6b7280'
};

const sessionValue: CSSProperties = { color: '#0b192d', fontSize: '0.92rem' };

const tokenText: CSSProperties = {
  fontSize: '0.76rem',
  color: '#374151',
  overflowWrap: 'anywhere'
};

const noticeBase: CSSProperties = {
  margin: 0,
  padding: '0.8rem 0.95rem',
  borderRadius: '0.875rem',
  border: '1px solid',
  lineHeight: 1.5
};
