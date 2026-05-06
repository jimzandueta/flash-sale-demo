import type { CSSProperties } from 'react';

type Props = {
  eyebrow: string;
  title: string;
  description?: string;
  sessionLabel?: string;
};

export function StorefrontHeader({ eyebrow, title, description, sessionLabel }: Props) {
  return (
    <header style={masthead}>
      <div style={stack}>
        <p style={eyebrowText}>{eyebrow}</p>
        <h1 style={pageTitle}>{title}</h1>
        {description ? <p style={pageDescription}>{description}</p> : null}
      </div>

      {sessionLabel ? (
        <div style={sessionChip}>
          <span style={sessionLabelText}>Session</span>
          <strong style={sessionValue}>{sessionLabel}</strong>
        </div>
      ) : null}
    </header>
  );
}

const masthead: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: '1rem',
  flexWrap: 'wrap',
  padding: '0.95rem 1rem',
  borderRadius: '0.95rem',
  border: '1px solid rgba(9,90,233,0.12)',
  background: '#ffffff',
  boxShadow: '0 1px 6px rgba(9,90,233,0.06)'
};

const stack: CSSProperties = {
  display: 'grid',
  gap: '0.25rem'
};

const eyebrowText: CSSProperties = {
  margin: 0,
  fontSize: '0.72rem',
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
  color: '#095ae9',
  fontWeight: 700
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
  maxWidth: '38rem',
  color: '#374151',
  lineHeight: 1.45,
  fontSize: '0.86rem'
};

const sessionChip: CSSProperties = {
  display: 'grid',
  gap: '0.15rem',
  padding: '0.55rem 0.75rem',
  minWidth: '150px',
  borderRadius: '999px',
  border: '1px solid rgba(9,90,233,0.12)',
  background: '#f8faff',
  justifyItems: 'start'
};

const sessionLabelText: CSSProperties = {
  fontSize: '0.62rem',
  fontWeight: 700,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: '#6b7280'
};

const sessionValue: CSSProperties = {
  color: '#0b192d',
  fontSize: '0.9rem'
};
