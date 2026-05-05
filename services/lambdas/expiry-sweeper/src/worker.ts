import { logger } from '../../shared/src/logger';

export async function releaseExpiredReservations(nowIso: string) {
  logger.debug('expiry-sweeper running at', nowIso);

  return 0;
}