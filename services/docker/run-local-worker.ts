const heartbeatIntervalMs = Number(process.env.WORKER_HEARTBEAT_INTERVAL_MS ?? '30000');

console.log(`[reservation-worker] local heartbeat every ${heartbeatIntervalMs}ms`);

setInterval(() => {
  console.log('[reservation-worker] waiting for local queue wiring');
}, heartbeatIntervalMs);