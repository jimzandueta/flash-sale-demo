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
    delete process.env.LOCAL_WORKER_MODE;
    delete process.env.WORKER_MANUAL_MODE;
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
    expect(consoleLog).toHaveBeenCalledWith('[reservation-worker] worker mode heartbeat; local heartbeat every 1ms');
  });

  it('skips the worker heartbeat loop when LOCAL_WORKER_MODE is manual', async () => {
    vi.resetModules();
    process.env.LOCAL_WORKER_MODE = 'manual';
    delete process.env.WORKER_MANUAL_MODE;

    const setIntervalStub = vi.fn(() => 1 as unknown as ReturnType<typeof setInterval>);
    const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    vi.stubGlobal('setInterval', setIntervalStub);

    await import('../../services/docker/run-local-worker');

    expect(pollQueuesOnce).not.toHaveBeenCalled();
    expect(setIntervalStub).not.toHaveBeenCalled();
    expect(consoleLog).toHaveBeenCalledWith('[reservation-worker] worker mode manual; waiting for debug trigger');
  });

  it('falls back to manual mode when only WORKER_MANUAL_MODE is enabled', async () => {
    vi.resetModules();
    delete process.env.LOCAL_WORKER_MODE;
    process.env.WORKER_MANUAL_MODE = 'true';

    const setIntervalStub = vi.fn(() => 1 as unknown as ReturnType<typeof setInterval>);
    const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    vi.stubGlobal('setInterval', setIntervalStub);

    await import('../../services/docker/run-local-worker');

    expect(pollQueuesOnce).not.toHaveBeenCalled();
    expect(setIntervalStub).not.toHaveBeenCalled();
    expect(consoleLog).toHaveBeenCalledWith('[reservation-worker] worker mode manual; waiting for debug trigger');
  });

  it('runs the heartbeat loop when LOCAL_WORKER_MODE is heartbeat', async () => {
    vi.resetModules();
    process.env.LOCAL_WORKER_MODE = 'heartbeat';
    delete process.env.WORKER_MANUAL_MODE;
    process.env.WORKER_HEARTBEAT_INTERVAL_MS = '25';

    pollQueuesOnce.mockResolvedValue({
      reservation: 0,
      purchase: 0,
      expiry: 0
    });

    const setIntervalStub = vi.fn(() => 1 as unknown as ReturnType<typeof setInterval>);
    const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    vi.stubGlobal('setInterval', setIntervalStub);

    await import('../../services/docker/run-local-worker');

    expect(pollQueuesOnce).toHaveBeenCalledTimes(1);
    expect(setIntervalStub).toHaveBeenCalledTimes(1);
    expect(consoleLog).toHaveBeenCalledWith('[reservation-worker] worker mode heartbeat; local heartbeat every 25ms');
  });

  it('uses a 5 second heartbeat by default in local heartbeat mode', async () => {
    vi.resetModules();
    process.env.LOCAL_WORKER_MODE = 'heartbeat';
    delete process.env.WORKER_MANUAL_MODE;
    delete process.env.WORKER_HEARTBEAT_INTERVAL_MS;

    pollQueuesOnce.mockResolvedValue({
      reservation: 0,
      purchase: 0,
      expiry: 0
    });

    const setIntervalStub = vi.fn(() => 1 as unknown as ReturnType<typeof setInterval>);
    const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    vi.stubGlobal('setInterval', setIntervalStub);

    await import('../../services/docker/run-local-worker');

    expect(pollQueuesOnce).toHaveBeenCalledTimes(1);
    expect(setIntervalStub).toHaveBeenCalledTimes(1);
    expect(setIntervalStub).toHaveBeenCalledWith(expect.any(Function), 5000);
    expect(consoleLog).toHaveBeenCalledWith('[reservation-worker] worker mode heartbeat; local heartbeat every 5000ms');
  });
});
