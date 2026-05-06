import type { CSSProperties } from 'react';
import type { HeaderChip, HeaderStep } from '../types';

type Props = {
  eyebrow: string;
  headline: string;
  supportingCopy?: string;
  steps?: HeaderStep[];
  chip?: HeaderChip;
};

export function StorefrontHeader({ eyebrow, headline, supportingCopy, steps, chip }: Props) {
  return (
    <header style={flowHeader}>
      <div style={brandStack}>
        <p style={eyebrowText}>{eyebrow}</p>
        <h1 style={headlineText}>{headline}</h1>
        {supportingCopy ? <p style={subtleText}>{supportingCopy}</p> : null}
        {steps?.length ? (
          <div style={flowSteps}>
            {steps.map((step) => (
              <span key={step.label} style={stepStyle(step.state)}>
                {step.label}
              </span>
            ))}
          </div>
        ) : null}
      </div>

      {chip ? (
        <div style={sessionChip}>
          <span style={fieldLabel}>{chip.label}</span>
          <span style={fieldValue}>{chip.value}</span>
          {chip.subtle ? <span style={mutedText}>{chip.subtle}</span> : null}
        </div>
      ) : null}
    </header>
  );
}

const flowHeader: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: '16px',
  padding: '18px 20px',
  border: '1px solid rgba(91, 117, 255, 0.16)',
  borderRadius: '18px',
  background: 'linear-gradient(180deg, rgba(255,255,255,0.98), rgba(245,247,255,0.94))',
  flexWrap: 'wrap'
};

const brandStack: CSSProperties = {
  display: 'grid',
  gap: '4px'
};

const eyebrowText: CSSProperties = {
  margin: 0,
  fontSize: '11px',
  fontWeight: 700,
  letterSpacing: '0.14em',
  textTransform: 'uppercase',
  color: '#5f6fff'
};

const headlineText: CSSProperties = {
  margin: 0,
  fontSize: '24px',
  lineHeight: 1.05,
  color: '#101828'
};

const subtleText: CSSProperties = {
  margin: 0,
  color: '#475467',
  fontSize: '14px',
  lineHeight: 1.55
};

const flowSteps: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '8px',
  marginTop: '10px'
};

function stepStyle(state: HeaderStep['state']): CSSProperties {
  const base: CSSProperties = {
    padding: '6px 10px',
    borderRadius: '999px',
    fontSize: '11px',
    fontWeight: 700,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    border: '1px solid #d0d5dd',
    color: '#667085',
    background: '#ffffff'
  };

  if (state === 'active') {
    return {
      ...base,
      color: '#ffffff',
      background: '#5f6fff',
      borderColor: '#5f6fff'
    };
  }

  if (state === 'complete') {
    return {
      ...base,
      color: '#5f6fff',
      background: '#eef2ff',
      borderColor: '#c7d2fe'
    };
  }

  return base;
}

const sessionChip: CSSProperties = {
  display: 'grid',
  gap: '2px',
  minWidth: '220px',
  padding: '12px 14px',
  borderRadius: '14px',
  background: '#ffffff',
  border: '1px solid #e4e7ec'
};

const fieldLabel: CSSProperties = {
  fontSize: '11px',
  fontWeight: 700,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: '#667085'
};

const fieldValue: CSSProperties = {
  color: '#101828',
  fontWeight: 600
};

const mutedText: CSSProperties = {
  color: '#667085',
  fontSize: '13px',
  lineHeight: 1.45
};
