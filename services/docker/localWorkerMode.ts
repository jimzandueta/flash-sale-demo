export type LocalWorkerMode = 'manual' | 'heartbeat';

export function resolveLocalWorkerMode(env: NodeJS.ProcessEnv = process.env): LocalWorkerMode {
  if (env.LOCAL_WORKER_MODE === 'manual') {
    return 'manual';
  }

  if (env.LOCAL_WORKER_MODE === 'heartbeat') {
    return 'heartbeat';
  }

  if (env.LOCAL_WORKER_MODE == null && env.WORKER_MANUAL_MODE === 'true') {
    return 'manual';
  }

  return 'heartbeat';
}
