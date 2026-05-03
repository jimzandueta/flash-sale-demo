import type { SaleItem } from '../api/client';

type SaleListProps = {
  items: SaleItem[];
  pendingSaleId: string | null;
  onReserve: (saleId: string) => void;
};

export function SaleList({ items, pendingSaleId, onReserve }: SaleListProps) {
  return (
    <section style={panel}>
      <div style={headerRow}>
        <div>
          <p style={kicker}>Live catalog</p>
          <h2 style={heading}>Active Sales</h2>
        </div>
      </div>

      <div style={cardGrid}>
        {items.map((item) => {
          const isActive = item.status === 'active';

          return (
            <article key={item.saleId} style={saleCard}>
              <div style={saleTopRow}>
                <span style={statusBadge(item.status)}>{item.status}</span>
                <span style={ttl}>{item.reservationTtlSeconds / 60} min hold</span>
              </div>
              <h3 style={cardTitle}>{item.itemName}</h3>
              <p style={meta}>{item.saleId}</p>
              <p style={windowText}>
                Window: {new Date(item.startsAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} -{' '}
                {new Date(item.endsAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
              </p>
              <button
                type="button"
                style={reserveButton(isActive)}
                disabled={!isActive || pendingSaleId === item.saleId}
                onClick={() => onReserve(item.saleId)}
              >
                {pendingSaleId === item.saleId ? 'Reserving...' : isActive ? 'Reserve now' : 'Unavailable'}
              </button>
            </article>
          );
        })}
      </div>
    </section>
  );
}

const panel: React.CSSProperties = {
  display: 'grid',
  gap: '1rem',
  padding: '1.35rem',
  borderRadius: '1.4rem',
  background: 'rgba(255, 255, 255, 0.86)',
  border: '1px solid rgba(16, 42, 67, 0.08)',
  boxShadow: '0 18px 45px rgba(16, 42, 67, 0.08)'
};

const headerRow: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center'
};

const kicker: React.CSSProperties = {
  margin: 0,
  fontSize: '0.82rem',
  textTransform: 'uppercase',
  letterSpacing: '0.12em',
  color: '#8b5e34'
};

const heading: React.CSSProperties = {
  margin: '0.2rem 0 0',
  color: '#18242f'
};

const cardGrid: React.CSSProperties = {
  display: 'grid',
  gap: '1rem',
  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))'
};

const saleCard: React.CSSProperties = {
  display: 'grid',
  gap: '0.75rem',
  padding: '1rem',
  borderRadius: '1.15rem',
  background: '#fffdf9',
  border: '1px solid rgba(214, 69, 47, 0.08)'
};

const saleTopRow: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center'
};

const cardTitle: React.CSSProperties = {
  margin: 0,
  color: '#18242f'
};

const meta: React.CSSProperties = {
  margin: 0,
  color: '#6b7c8f',
  fontSize: '0.88rem'
};

const windowText: React.CSSProperties = {
  margin: 0,
  color: '#365166',
  lineHeight: 1.5,
  fontSize: '0.92rem'
};

const ttl: React.CSSProperties = {
  fontSize: '0.78rem',
  color: '#365166'
};

const statusBadge = (status: SaleItem['status']): React.CSSProperties => ({
  display: 'inline-flex',
  padding: '0.28rem 0.65rem',
  borderRadius: '999px',
  fontSize: '0.78rem',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  background:
    status === 'active' ? 'rgba(33, 150, 83, 0.12)' : status === 'upcoming' ? 'rgba(199, 122, 31, 0.12)' : 'rgba(107, 124, 143, 0.16)',
  color: status === 'active' ? '#1b7d42' : status === 'upcoming' ? '#9f5b10' : '#56697f'
});

const reserveButton = (isActive: boolean): React.CSSProperties => ({
  border: 'none',
  borderRadius: '999px',
  padding: '0.8rem 0.95rem',
  fontWeight: 700,
  cursor: isActive ? 'pointer' : 'not-allowed',
  background: isActive ? '#102a43' : '#d9dee5',
  color: isActive ? '#fffaf3' : '#718096'
});