import { afterEach, describe, expect, it, vi } from 'vitest';

const pollQueuesOnce = vi.fn();

vi.mock('../../services/lambdas/reservation-worker/src/poller', () => ({
  pollQueuesOnce
}));

describe('run-local-worker', () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    vi.resetModules();
    delete process.env.WORKER_HEARTBEAT_INTERVAL_MS;
  });

  it('logs startup poll failures instead of rejecting module startup', async () => {
    process.env.WORKER_HEARTBEAT_INTERVAL_MS = '1';

    pollQueuesOnce.mockRejectedValueOnce(new Error('queue unavailable')).mockResolvedValue({
      reservation: 0,
      purchase: 0,
      expiry: 0
    });

    const setIntervalStub = vi.fn(() => 1 as unknown as ReturnType<typeof setInterval>);
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    vi.stubGlobal('setInterval', setIntervalStub);

    await expect(import('../../services/docker/run-local-worker')).resolves.toBeDefined();

    expect(consoleError).toHaveBeenCalledWith(
      '[reservation-worker] poll failed',
      expect.objectContaining({ message: 'queue unavailable' })
    );
    expect(setIntervalStub).toHaveBeenCalledTimes(1);
    expect(consoleLog).toHaveBeenCalledWith('[reservation-worker] local heartbeat every 1ms');
  });
});
