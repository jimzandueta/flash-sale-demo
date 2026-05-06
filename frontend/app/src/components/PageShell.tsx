import type { CSSProperties, ReactNode } from 'react';
import type { HeaderContent, Notice } from '../types';
import { StorefrontHeader } from './StorefrontHeader';

type Props = {
  header: HeaderContent;
  notice: Notice | null;
  children: ReactNode;
  dock?: ReactNode;
};

export function PageShell({ header, notice, children, dock }: Props) {
  return (
    <main style={shell}>
      <section style={frame}>
        <StorefrontHeader {...header} />
        {notice ? <p style={noticeStyle(notice.tone)}>{notice.text}</p> : null}
        {children}
      </section>
      {dock}
    </main>
  );
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

const shell: CSSProperties = {
  position: 'relative',
  minHeight: '100vh',
  padding: 'clamp(0.85rem, 2vw, 1.5rem)',
  background: '#f8faff',
  fontFamily: 'Avenir Next, Gill Sans, sans-serif'
};

const frame: CSSProperties = {
  display: 'grid',
  gap: '16px',
  maxWidth: '100%',
  margin: '0 auto',
  padding: '18px',
  borderRadius: '22px',
  border: '1px solid rgba(91, 117, 255, 0.12)',
  background: 'linear-gradient(180deg, #fbfcff 0%, #f3f6ff 100%)',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.8)'
};

const noticeBase: CSSProperties = {
  margin: 0,
  padding: '0.8rem 0.95rem',
  borderRadius: '0.875rem',
  border: '1px solid',
  lineHeight: 1.5
};
