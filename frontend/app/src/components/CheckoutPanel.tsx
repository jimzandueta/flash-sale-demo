import type { CheckoutResponse, ReservationItem } from '../api/client';

type CheckoutPanelProps = {
  reservation: ReservationItem | null;
  simulateFailure: boolean;
  isSubmitting: boolean;
  lastResult: CheckoutResponse | null;
  onToggleFailure: (value: boolean) => void;
  onCheckout: () => void;
};

export function CheckoutPanel({
  reservation,
  simulateFailure,
  isSubmitting,
  lastResult,
  onToggleFailure,
  onCheckout
}: CheckoutPanelProps) {
  return (
    <section style={panel}>
      <div>
        <p style={kicker}>Mock payment</p>
        <h2 style={heading}>Checkout</h2>
      </div>

      {reservation ? (
        <>
          <div style={summaryCard}>
            <span style={summaryTitle}>{reservation.saleId}</span>
            <span style={summaryMeta}>Reservation {reservation.reservationId}</span>
          </div>

          <label style={toggleRow}>
            <input
              type="checkbox"
              checked={simulateFailure}
              onChange={(event) => onToggleFailure(event.target.checked)}
            />
            Simulate payment failure
          </label>

          <button type="button" onClick={onCheckout} style={checkoutButton} disabled={isSubmitting}>
            {isSubmitting ? 'Processing...' : 'Run checkout'}
          </button>

          {lastResult ? (
            <p style={resultBanner(lastResult.status)}>
              {lastResult.status === 'PURCHASED'
                ? `Purchase completed at ${new Date(lastResult.purchasedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`
                : 'Payment failed. Reservation remains active until expiry.'}
            </p>
          ) : null}
        </>
      ) : (
        <p style={emptyState}>Select a reservation to try the mocked checkout flow.</p>
      )}
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

const summaryCard: React.CSSProperties = {
  display: 'grid',
  gap: '0.35rem',
  padding: '1rem',
  borderRadius: '1rem',
  background: '#fff8ef'
};

const summaryTitle: React.CSSProperties = {
  fontWeight: 700,
  color: '#18242f'
};

const summaryMeta: React.CSSProperties = {
  color: '#546779',
  fontSize: '0.9rem'
};

const toggleRow: React.CSSProperties = {
  display: 'flex',
  gap: '0.65rem',
  alignItems: 'center',
  color: '#365166'
};

const checkoutButton: React.CSSProperties = {
  border: 'none',
  borderRadius: '999px',
  padding: '0.85rem 1rem',
  fontWeight: 700,
  cursor: 'pointer',
  background: '#d6452f',
  color: '#fffaf3'
};

const emptyState: React.CSSProperties = {
  margin: 0,
  color: '#546779',
  lineHeight: 1.6
};

const resultBanner = (status: CheckoutResponse['status']): React.CSSProperties => ({
  margin: 0,
  padding: '0.9rem 1rem',
  borderRadius: '1rem',
  background: status === 'PURCHASED' ? 'rgba(33, 150, 83, 0.12)' : 'rgba(214, 69, 47, 0.12)',
  color: status === 'PURCHASED' ? '#1b7d42' : '#a13c2a',
  lineHeight: 1.5
});