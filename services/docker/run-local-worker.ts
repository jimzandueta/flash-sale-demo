import { pollQueuesOnce } from '../lambdas/reservation-worker/src/poller';
import { resolveLocalWorkerMode } from './localWorkerMode';

const heartbeatIntervalMs = Number(process.env.WORKER_HEARTBEAT_INTERVAL_MS ?? '5000');
const workerMode = resolveLocalWorkerMode();

async function runLoop() {
  try {
    const processed = await pollQueuesOnce();
    console.log('[reservation-worker] processed queues', processed);
  } catch (error) {
    console.error('[reservation-worker] poll failed', error);
  }
}

if (workerMode === 'manual') {
  console.log('[reservation-worker] worker mode manual; waiting for debug trigger');
} else {
  console.log(`[reservation-worker] worker mode heartbeat; local heartbeat every ${heartbeatIntervalMs}ms`);
  await runLoop();

  setInterval(() => {
    void runLoop();
  }, heartbeatIntervalMs);
}
