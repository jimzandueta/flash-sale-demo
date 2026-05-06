import { afterEach, describe, expect, it, vi } from 'vitest';

const releaseExpiredReservations = vi.fn();

vi.mock('../../services/lambdas/expiry-sweeper/src/worker', () => ({
  releaseExpiredReservations
}));

describe('run-local-expiry-sweeper', () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    vi.resetModules();
    delete process.env.EXPIRY_SWEEP_INTERVAL_MS;
  });

  it('runs one sweep immediately and schedules future sweeps every 10 seconds by default', async () => {
    releaseExpiredReservations.mockResolvedValue(0);

    const setIntervalStub = vi.fn(() => 1 as unknown as ReturnType<typeof setInterval>);
    const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    vi.stubGlobal('setInterval', setIntervalStub);

    await import('../../services/docker/run-local-expiry-sweeper');

    expect(releaseExpiredReservations).toHaveBeenCalledTimes(1);
    expect(setIntervalStub).toHaveBeenCalledTimes(1);
    expect(setIntervalStub).toHaveBeenCalledWith(expect.any(Function), 10000);
    expect(consoleLog).toHaveBeenCalledWith('[expiry-sweeper] released 0 reservations');
  });
});
