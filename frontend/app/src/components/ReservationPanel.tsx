import { useEffect, useState } from 'react';
import type { ReservationItem } from '../api/client';
import { formatRemaining } from '../dateUtils';

type ReservationPanelProps = {
  items: ReservationItem[];
  selectedReservationId: string | null;
  onSelectReservation: (reservationId: string) => void;
};

export function ReservationPanel({
  items,
  selectedReservationId,
  onSelectReservation
}: ReservationPanelProps) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const intervalId = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(intervalId);
  }, []);

  return (
    <section style={panel}>
      <div>
        <p style={kicker}>Hold ledger</p>
        <h2 style={heading}>Reservations</h2>
      </div>

      {items.length === 0 ? (
        <p style={emptyState}>No active holds yet. Reserve an active sale to pin it here.</p>
      ) : (
        <div style={list}>
          {items.map((item) => {
            const isSelected = item.reservationId === selectedReservationId;

            return (
              <button
                key={item.reservationId}
                type="button"
                onClick={() => onSelectReservation(item.reservationId)}
                style={reservationCard(isSelected)}
              >
                <span style={reservationSale}>{item.saleId}</span>
                <span style={reservationMeta}>Reservation {item.reservationId}</span>
                <span style={reservationMeta}>Expires in {formatRemaining(item.expiresAt, now)}</span>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}

const panel: React.CSSProperties = {
  display: 'grid',
  gap: '1rem',
  padding: '1.35rem',
  borderRadius: '1.4rem',
  background: 'rgba(16, 42, 67, 0.94)',
  color: '#f8f4ec'
};

const kicker: React.CSSProperties = {
  margin: 0,
  fontSize: '0.82rem',
  textTransform: 'uppercase',
  letterSpacing: '0.12em',
  color: '#f0b15a'
};

const heading: React.CSSProperties = {
  margin: '0.2rem 0 0'
};

const emptyState: React.CSSProperties = {
  margin: 0,
  color: '#b6c4d2',
  lineHeight: 1.6
};

const list: React.CSSProperties = {
  display: 'grid',
  gap: '0.8rem'
};

const reservationCard = (isSelected: boolean): React.CSSProperties => ({
  display: 'grid',
  gap: '0.4rem',
  textAlign: 'left',
  border: '1px solid rgba(240, 177, 90, 0.2)',
  borderRadius: '1rem',
  padding: '0.9rem 1rem',
  cursor: 'pointer',
  background: isSelected ? 'rgba(240, 177, 90, 0.18)' : 'rgba(255, 255, 255, 0.04)',
  color: '#f8f4ec'
});

const reservationSale: React.CSSProperties = {
  fontWeight: 700
};

const reservationMeta: React.CSSProperties = {
  fontSize: '0.88rem',
  color: '#d8e0e8'
};