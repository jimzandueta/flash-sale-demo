import { afterEach, describe, expect, it, vi } from 'vitest';
import { logger } from '../../services/lambdas/shared/src/logger';

afterEach(() => {
  delete process.env.LOG_LEVEL;
  vi.restoreAllMocks();
});

describe('logger', () => {
  it('suppresses debug logs when LOG_LEVEL=info', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    process.env.LOG_LEVEL = 'info';
    logger.debug('hidden');

    expect(spy).not.toHaveBeenCalled();
  });
});