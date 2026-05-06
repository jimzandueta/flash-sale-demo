import type { CSSProperties, ReactNode } from 'react';
import type { SessionResponse } from '../api/client';
import type { Notice, Page } from '../types';
import { StorefrontHeader } from './StorefrontHeader';

type Props = {
  page: Page;
  title: string;
  description?: string;
  session: SessionResponse | null;
  notice: Notice | null;
  children: ReactNode;
  aside?: ReactNode;
};

export function PageShell({ page, title, description, session, notice, children, aside }: Props) {
  return (
    <main style={shell}>
      <section style={frame}>
        <StorefrontHeader
          eyebrow={eyebrowByPage[page]}
          title={title}
          description={description}
          sessionLabel={session?.displayName}
        />

        {aside}

        {notice ? <p style={noticeStyle(notice.tone)}>{notice.text}</p> : null}

        {children}
      </section>
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

const eyebrowByPage: Record<Page, string> = {
  landing: 'Bookipi / Flash Sale',
  'product-list': 'Bookipi / Flash Sale / Products',
  'product-page': 'Bookipi / Flash Sale / Product',
  checkout: 'Bookipi / Flash Sale / Checkout',
  confirmation: 'Bookipi / Flash Sale / Confirmation'
};

const noticeBase: CSSProperties = {
  margin: 0,
  padding: '0.8rem 0.95rem',
  borderRadius: '0.875rem',
  border: '1px solid',
  lineHeight: 1.5
};
