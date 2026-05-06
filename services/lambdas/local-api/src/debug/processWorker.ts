import { releaseExpiredReservations } from '../../../expiry-sweeper/src/worker';
import { pollQueuesOnce } from '../../../reservation-worker/src/poller';

export async function processWorkerNow() {
  const processedAt = new Date().toISOString();

  await releaseExpiredReservations(processedAt);
  const processed = await pollQueuesOnce();

  return {
    processed,
    processedAt
  };
}
