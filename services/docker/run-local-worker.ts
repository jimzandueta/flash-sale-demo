import { pollQueuesOnce } from '../lambdas/reservation-worker/src/poller';

const heartbeatIntervalMs = Number(process.env.WORKER_HEARTBEAT_INTERVAL_MS ?? '30000');

console.log(`[reservation-worker] local heartbeat every ${heartbeatIntervalMs}ms`);

async function runLoop() {
  try {
    const processed = await pollQueuesOnce();
    console.log('[reservation-worker] processed queues', processed);
  } catch (error) {
    console.error('[reservation-worker] poll failed', error);
  }
}

await runLoop();

setInterval(() => {
  void runLoop();
}, heartbeatIntervalMs);
