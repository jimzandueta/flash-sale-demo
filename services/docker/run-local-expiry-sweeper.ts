import { releaseExpiredReservations } from '../lambdas/expiry-sweeper/src/worker';

const sweepIntervalMs = Number(process.env.EXPIRY_SWEEP_INTERVAL_MS ?? '60000');

async function runSweep() {
  const released = await releaseExpiredReservations(new Date().toISOString());
  console.log(`[expiry-sweeper] released ${released} reservations`);
}

await runSweep();

setInterval(() => {
  void runSweep();
}, sweepIntervalMs);