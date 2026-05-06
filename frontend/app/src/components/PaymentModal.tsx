import type { CSSProperties } from 'react';
import { formatUsd, storefrontPrice } from '../storefrontPricing';
import { formatRemaining } from '../dateUtils';
import type { CartReservation } from '../types';

type Props = {
  item: CartReservation;
  shopperName: string;
  now: number;
  isSubmitting: boolean;
  isSimulatingFailure: boolean;
  error: string | null;
  onToggleSimulateFailure: () => void;
  onCancel: () => void;
  onConfirm: () => void;
};

export function PaymentModal({
  item,
  shopperName,
  now,
  isSubmitting,
  isSimulatingFailure,
  error,
  onToggleSimulateFailure,
  onCancel,
  onConfirm
}: Props) {
  const price = storefrontPrice(item.itemName, item.price);

  const msRemaining = Date.parse(item.expiresAt) - now;
  const isUrgent = msRemaining > 0 && msRemaining < 60_000;

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="payment-modal-title" style={backdrop}>
      <div style={modal}>
        <div style={modalHead}>
          <div>
            <p style={modalEyebrow}>Payment</p>
            <h2 id="payment-modal-title" style={modalTitle}>
              Pay for {item.itemName}
            </h2>
          </div>
          <span style={isUrgent ? timerPillUrgent : timerPill}>
            {formatRemaining(item.expiresAt, now)} left
          </span>
        </div>

        <div style={itemReview}>
          <div style={inlineRow}>
            <strong style={itemNameStyle}>{item.itemName}</strong>
            <span style={itemPriceStyle}>{price === null ? 'Price unavailable' : formatUsd(price)}</span>
          </div>
          <div style={inlineRow}>
            <span style={saleWindowPill}>{item.saleId}</span>
            <span style={mutedText}>Reservation `{item.reservationId}`</span>
          </div>
        </div>

        <div style={formGrid}>
          <div style={field}>
            <div style={fieldHead}>
              <span style={fieldLabel}>Cardholder name</span>
              <span style={mutedText}>Prefilled</span>
            </div>
            <span style={fieldValue}>{shopperName}</span>
          </div>
          <div style={field}>
            <div style={fieldHead}>
              <span style={fieldLabel}>Card number</span>
              <span style={mutedText}>Read only</span>
            </div>
            <span style={fieldValue}>**** **** **** 4242</span>
          </div>
          <div style={field}>
            <span style={fieldLabel}>Expiry</span>
            <span style={fieldValue}>12/30</span>
          </div>
          <div style={field}>
            <span style={fieldLabel}>CVV</span>
            <span style={fieldValue}>****</span>
          </div>
        </div>

        <div style={testingBox}>
          <div style={inlineRow}>
            <span style={testingPill}>Payment testing</span>
            <span style={mutedText}>Optional</span>
          </div>
          <div style={toggleRow}>
            <div style={toggleCopy}>
              <span style={toggleLabel}>Simulate payment failure</span>
              <span style={toggleHelp}>Use this only when checking failure handling.</span>
            </div>
            <button
              style={isSimulatingFailure ? switchToggle : switchStyle}
              onClick={!isSubmitting ? onToggleSimulateFailure : undefined}
              disabled={isSubmitting}
              aria-pressed={isSimulatingFailure}
              type="button"
            />
          </div>
        </div>

        {error ? <p style={errorText}>{error}</p> : null}

        <div style={modalActions}>
          <button style={cancelButton} disabled={isSubmitting} onClick={onCancel}>
            Cancel
          </button>
          <button style={confirmButton} disabled={isSubmitting} onClick={onConfirm}>
            {isSubmitting ? 'Processing...' : 'Confirm payment'}
          </button>
        </div>
      </div>
    </div>
  );
}

const backdrop: CSSProperties = {
  position: 'fixed',
  inset: 0,
  display: 'grid',
  placeItems: 'center',
  background: 'rgba(15,23,42,.32)',
  padding: '24px',
  zIndex: 20
};

const modal: CSSProperties = {
  width: 'min(100%, 640px)',
  display: 'grid',
  gap: '16px',
  padding: '22px',
  borderRadius: '24px',
  background: '#ffffff',
  border: '1px solid rgba(95,111,255,.18)',
  boxShadow: '0 24px 80px rgba(15,23,42,.22)'
};

const modalHead: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  gap: '16px'
};

const modalEyebrow: CSSProperties = {
  margin: 0,
  fontSize: '11px',
  fontWeight: 700,
  letterSpacing: '.14em',
  textTransform: 'uppercase',
  color: '#5f6fff'
};

const modalTitle: CSSProperties = {
  margin: '4px 0 0',
  fontSize: '28px',
  color: '#101828'
};

const timerPill: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: '28px',
  padding: '0 12px',
  borderRadius: '999px',
  background: '#eef2ff',
  color: '#4f46e5',
  fontSize: '11px',
  fontWeight: 700,
  letterSpacing: '.08em',
  textTransform: 'uppercase'
};

const timerPillUrgent: CSSProperties = {
  ...timerPill,
  background: '#d32f2f',
  color: '#fff'
};

const itemReview: CSSProperties = {
  display: 'grid',
  gap: '8px',
  padding: '16px',
  borderRadius: '18px',
  background: '#f8faff',
  border: '1px solid rgba(95,111,255,.10)'
};

const inlineRow: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: '12px',
  flexWrap: 'wrap'
};

const itemNameStyle: CSSProperties = {
  fontSize: '20px',
  fontWeight: 700,
  color: '#101828'
};

const itemPriceStyle: CSSProperties = {
  fontSize: '22px',
  fontWeight: 800,
  color: '#101828',
  textAlign: 'right',
  whiteSpace: 'nowrap'
};

const saleWindowPill: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: '28px',
  padding: '0 12px',
  borderRadius: '999px',
  background: '#f8fafc',
  color: '#475467',
  fontSize: '11px',
  fontWeight: 700,
  letterSpacing: '.08em',
  textTransform: 'uppercase',
  border: '1px solid rgba(15,23,42,.08)'
};

const mutedText: CSSProperties = {
  fontSize: '12px',
  color: '#667085'
};

const formGrid: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: '12px'
};

const field: CSSProperties = {
  display: 'grid',
  gap: '8px',
  padding: '14px',
  borderRadius: '16px',
  background: '#fff',
  border: '1px solid rgba(15,23,42,.08)'
};

const fieldHead: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: '8px'
};

const fieldLabel: CSSProperties = {
  fontSize: '11px',
  fontWeight: 700,
  letterSpacing: '.08em',
  textTransform: 'uppercase',
  color: '#667085'
};

const fieldValue: CSSProperties = {
  fontSize: '16px',
  fontWeight: 700,
  color: '#101828'
};

const testingBox: CSSProperties = {
  display: 'grid',
  gap: '8px',
  padding: '14px',
  borderRadius: '16px',
  background: '#faf5ff',
  border: '1px solid rgba(168,85,247,.14)'
};

const testingPill: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: '24px',
  padding: '0 10px',
  borderRadius: '999px',
  background: '#ede9fe',
  color: '#6d28d9',
  fontSize: '11px',
  fontWeight: 700,
  letterSpacing: '.08em',
  textTransform: 'uppercase'
};

const toggleRow: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '12px',
  padding: '12px 14px',
  borderRadius: '14px',
  background: '#fff',
  border: '1px solid rgba(168,85,247,.12)'
};

const toggleCopy: CSSProperties = {
  display: 'grid',
  gap: '2px'
};

const toggleLabel: CSSProperties = {
  fontSize: '12px',
  fontWeight: 700,
  color: '#101828'
};

const toggleHelp: CSSProperties = {
  fontSize: '11px',
  color: '#667085'
};

const switchStyle: CSSProperties = {
  position: 'relative',
  width: '42px',
  height: '24px',
  borderRadius: '999px',
  background: '#c4b5fd',
  boxShadow: 'inset 0 0 0 1px rgba(109,40,217,.12)',
  border: 'none',
  cursor: 'pointer'
};

const switchToggle: CSSProperties = {
  ...switchStyle,
  background: '#16a34a',
  boxShadow: 'inset 0 0 0 1px rgba(22,163,74,.12)'
};

const errorText: CSSProperties = {
  margin: 0,
  padding: '14px',
  borderRadius: '16px',
  background: 'rgba(192,57,43,.08)',
  border: '1px solid rgba(192,57,43,.18)',
  color: '#c0392b',
  fontSize: '13px'
};

const modalActions: CSSProperties = {
  display: 'flex',
  justifyContent: 'flex-end',
  gap: '10px',
  flexWrap: 'wrap'
};

const cancelButton: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: '12px',
  padding: '10px 14px',
  fontWeight: 700,
  fontSize: '13px',
  border: '1px solid #c7d2fe',
  background: '#fff',
  color: '#5f6fff',
  cursor: 'pointer'
};

const confirmButton: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: '12px',
  padding: '10px 14px',
  fontWeight: 700,
  fontSize: '13px',
  border: '1px solid #16a34a',
  background: '#16a34a',
  color: '#fff',
  cursor: 'pointer'
};
