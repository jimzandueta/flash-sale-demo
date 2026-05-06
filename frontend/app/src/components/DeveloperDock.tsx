import { type CSSProperties } from 'react';
import type { DeveloperDockEvent, ObservabilitySnapshot } from '../types';

type Props = {
  snapshot: ObservabilitySnapshot | null;
  events: DeveloperDockEvent[];
  fallbackSummary: ObservabilitySnapshot['app'];
  isProcessingWorker: boolean;
  isRefreshingSnapshot: boolean;
  onProcessWorkerNow: () => void;
  onRefreshSnapshot: () => void;
};

export function DeveloperDock({
  snapshot,
  events,
  fallbackSummary,
  isProcessingWorker,
  isRefreshingSnapshot,
  onProcessWorkerNow,
  onRefreshSnapshot
}: Props) {
  const summary = snapshot?.app ?? fallbackSummary;

  return (
    <section style={dock}>
      <div style={headerRow}>
        <div style={titleGroup}>
          <span style={eyebrow}>Developer dock</span>
        </div>
      </div>

      <div style={summaryGrid}>
        <SummaryCell label="Page" value={summary.page} />
        <SummaryCell
          label="Session"
          value={
            snapshot?.shopper.userToken ?? summary.userSessionLabel?.replace(/^Session:\s*/, '') ?? 'n/a'
          }
        />
        <SummaryCell label="Worker mode" value={snapshot?.workerMode ?? 'manual'} />
        <SummaryCell label="Active sales" value={String(summary.activeSaleCount)} />
        <SummaryCell label="Cart" value={String(summary.cartCount)} />
        <SummaryCell label="Purchased" value={String(summary.purchaseCount)} />
      </div>

      <div style={openLayout}>
        {snapshot ? (
          <>
            <div style={actionsRow}>
              <button
                style={actionButton}
                onClick={onProcessWorkerNow}
                disabled={isProcessingWorker || isRefreshingSnapshot}
              >
                {isProcessingWorker ? 'Processing worker...' : 'Process worker now'}
              </button>
              <button
                style={toggleButton}
                onClick={onRefreshSnapshot}
                disabled={isProcessingWorker || isRefreshingSnapshot}
              >
                {isRefreshingSnapshot ? 'Refreshing...' : 'Refresh'}
              </button>
            </div>

            <p style={statusLine}>{workerModeMessage(snapshot.workerMode)}</p>

            <p style={statusLine}>{workerStatusLine(snapshot)}</p>

            <p style={statusLine}>Last updated: {snapshot.generatedAt}</p>

            <section style={pipelineStrip}>
              {orderedPipeline(snapshot).map((stage) => (
                <div key={stage.stage} style={pipelineStage}>
                  <span style={pipelineTitle}>{stage.title}</span>
                  <span style={pipelineBadge(stage.status)}>{stage.status}</span>
                  <span style={pipelineSummary}>{stage.summary}</span>
                </div>
              ))}
            </section>

            <DataTable
              ariaLabel="Redis data"
              headers={['Key type', 'Identifier', 'Value / Status', 'TTL / Expires', 'Notes']}
              rows={buildRedisRows(snapshot)}
              emptyMessage="No Redis records for this shopper or sale set yet."
            />
            <DataTable
              ariaLabel="SQS data"
              headers={['Queue', 'Visible', 'In flight', 'Status']}
              rows={buildSqsRows(snapshot)}
              emptyMessage="No queue metrics available."
            />
            <DataTable
              ariaLabel="DynamoDB data"
              headers={['Reservation ID', 'Sale ID', 'User', 'Status', 'Expires At', 'Purchased At', 'Updated At']}
              rows={buildDynamoRows(snapshot)}
              emptyMessage="No durable shopper records yet."
            />
            <DataTable
              ariaLabel="Activity"
              headers={['Time', 'Source', 'Action', 'Effect']}
              rows={events.map((event) => [event.time, event.source, event.action, event.effect])}
              emptyMessage="No activity captured yet."
            />
          </>
        ) : (
          <p style={statusLine}>Observability data unavailable.</p>
        )}
      </div>
    </section>
  );
}

function workerModeMessage(workerMode: ObservabilitySnapshot['workerMode']) {
  if (workerMode === 'heartbeat') {
    return 'Background polling is active. Queue counts may change without a manual trigger.';
  }

  return 'Processing is paused until you click Process worker now.';
}

function workerStatusLine(snapshot: ObservabilitySnapshot) {
  if (snapshot.manualWorker.lastError) {
    return `Last worker result: ${snapshot.manualWorker.lastError}`;
  }

  if (snapshot.workerMode === 'manual') {
    return `Last manual run: ${snapshot.manualWorker.lastRunAt ?? snapshot.generatedAt}`;
  }

  if (snapshot.manualWorker.lastRunAt) {
    return `Last manual run: ${snapshot.manualWorker.lastRunAt}`;
  }

  return `Last heartbeat: ${snapshot.generatedAt}`;
}

function orderedPipeline(snapshot: ObservabilitySnapshot) {
  const stageOrder: ObservabilitySnapshot['pipeline'][number]['stage'][] = [
    'shopper',
    'redis',
    'sqs',
    'worker',
    'dynamodb'
  ];

  return [...snapshot.pipeline].sort((left, right) => stageOrder.indexOf(left.stage) - stageOrder.indexOf(right.stage));
}

function SummaryCell({
  label,
  value,
  secondaryValue
}: {
  label: string;
  value: string;
  secondaryValue?: string;
}) {
  return (
    <div style={summaryCell}>
      <span style={summaryLabel}>{label}</span>
      <span style={summaryValue}>{value}</span>
      {secondaryValue ? <span style={summarySecondary}>{secondaryValue}</span> : null}
    </div>
  );
}

function DataTable({
  ariaLabel,
  headers,
  rows,
  emptyMessage
}: {
  ariaLabel: string;
  headers: string[];
  rows: string[][];
  emptyMessage: string;
}) {
  return (
    <table aria-label={ariaLabel} style={table}>
      <thead>
        <tr>{headers.map((header) => <th key={header} style={th}>{header}</th>)}</tr>
      </thead>
      <tbody>
        {rows.length === 0 ? (
          <tr>
            <td colSpan={headers.length} style={emptyCell}>{emptyMessage}</td>
          </tr>
        ) : (
          rows.map((row, index) => (
            <tr key={`${ariaLabel}-${index}`}>
              {row.map((cell, cellIndex) => <td key={cellIndex} style={td}>{cell}</td>)}
            </tr>
          ))
        )}
      </tbody>
    </table>
  );
}

function buildRedisRows(snapshot: ObservabilitySnapshot) {
  return [
    ...snapshot.redis.stockBySale.map((entry) => ['stock', entry.saleId, String(entry.stock ?? 'n/a'), '-', 'sale stock']),
    ...snapshot.redis.reservations.map((entry) => [
      'reservation',
      entry.reservationId,
      entry.status,
      entry.expiresAt,
      entry.saleId
    ]),
    ...snapshot.redis.expiryQueues.map((entry) => ['expiry zset', entry.saleId, String(entry.size), '-', 'queued expiries'])
  ];
}

function buildSqsRows(snapshot: ObservabilitySnapshot) {
  return snapshot.sqs.queues.map((queue) => [
    queue.type,
    queue.visibleMessages === null ? 'n/a' : String(queue.visibleMessages),
    queue.inFlightMessages === null ? 'n/a' : String(queue.inFlightMessages),
    snapshot.sqs.status
  ]);
}

function buildDynamoRows(snapshot: ObservabilitySnapshot) {
  return snapshot.dynamodb.shopperRecords.map((record) => [
    record.reservationId,
    record.saleId,
    record.userToken,
    record.status,
    record.expiresAt ?? '-',
    record.purchasedAt ?? '-',
    record.updatedAt ?? '-'
  ]);
}

function pipelineBadge(status: ObservabilitySnapshot['pipeline'][number]['status']): CSSProperties {
  return {
    ...badge,
    background:
      status === 'waiting' ? 'rgba(250,204,21,0.18)' :
      status === 'warning' ? 'rgba(248,113,113,0.18)' :
      status === 'unavailable' ? 'rgba(148,163,184,0.18)' :
      'rgba(34,197,94,0.18)',
    color:
      status === 'waiting' ? '#fde68a' :
      status === 'warning' ? '#fecaca' :
      status === 'unavailable' ? '#e2e8f0' :
      '#dcfce7'
  };
}

const dock: CSSProperties = {
  display: 'grid',
  gap: '14px',
  marginTop: '16px',
  padding: '16px',
  borderRadius: '18px',
  background: '#111827',
  color: '#f9fafb',
  border: '1px solid rgba(148,163,184,0.2)'
};

const headerRow: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: '12px',
  flexWrap: 'wrap',
  alignItems: 'center'
};

const titleGroup: CSSProperties = {
  display: 'grid',
  gap: '4px'
};

const eyebrow: CSSProperties = {
  fontSize: '11px',
  fontWeight: 700,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: '#93c5fd'
};

const actionsRow: CSSProperties = {
  display: 'flex',
  gap: '8px',
  flexWrap: 'wrap'
};

const baseButton: CSSProperties = {
  border: '1px solid rgba(148,163,184,0.2)',
  borderRadius: '10px',
  minHeight: '38px',
  padding: '0 12px',
  fontSize: '12px',
  fontWeight: 700,
  cursor: 'pointer'
};

const actionButton: CSSProperties = {
  ...baseButton,
  background: '#eef2ff',
  color: '#312e81'
};

const toggleButton: CSSProperties = {
  ...baseButton,
  background: 'rgba(255,255,255,0.06)',
  color: '#f8fafc'
};

const summaryGrid: CSSProperties = {
  display: 'grid',
  gap: '10px',
  gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))'
};

const summaryCell: CSSProperties = {
  display: 'grid',
  gap: '4px',
  padding: '12px',
  borderRadius: '12px',
  background: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(148,163,184,0.16)'
};

const summaryLabel: CSSProperties = {
  fontSize: '11px',
  fontWeight: 700,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: '#cbd5e1'
};

const summaryValue: CSSProperties = {
  fontSize: '14px',
  fontWeight: 700,
  color: '#ffffff'
};

const summarySecondary: CSSProperties = {
  fontSize: '12px',
  lineHeight: 1.35,
  color: '#cbd5e1',
  wordBreak: 'break-all'
};

const openLayout: CSSProperties = {
  display: 'grid',
  gap: '14px'
};

const statusLine: CSSProperties = {
  margin: 0,
  fontSize: '13px',
  color: '#cbd5e1'
};

const pipelineStrip: CSSProperties = {
  display: 'grid',
  gap: '10px',
  gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))'
};

const pipelineStage: CSSProperties = {
  display: 'grid',
  gap: '6px',
  padding: '12px',
  borderRadius: '12px',
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(148,163,184,0.16)'
};

const pipelineTitle: CSSProperties = {
  fontSize: '13px',
  fontWeight: 700,
  color: '#ffffff'
};

const pipelineSummary: CSSProperties = {
  fontSize: '12px',
  lineHeight: 1.45,
  color: '#e2e8f0'
};

const badge: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 'fit-content',
  padding: '4px 8px',
  borderRadius: '999px',
  fontSize: '11px',
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.06em'
};

const table: CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  background: 'rgba(255,255,255,0.04)',
  borderRadius: '12px',
  overflow: 'hidden'
};

const th: CSSProperties = {
  textAlign: 'left',
  padding: '10px 12px',
  fontSize: '11px',
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  color: '#cbd5e1',
  borderBottom: '1px solid rgba(148,163,184,0.16)'
};

const td: CSSProperties = {
  padding: '10px 12px',
  fontSize: '12px',
  lineHeight: 1.4,
  color: '#f8fafc',
  borderBottom: '1px solid rgba(148,163,184,0.1)'
};

const emptyCell: CSSProperties = {
  ...td,
  color: '#cbd5e1',
  textAlign: 'left'
};
