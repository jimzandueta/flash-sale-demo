export const logger = {
  debug: (...args: unknown[]) => console.log('[debug]', ...args),
  info: (...args: unknown[]) => console.log('[info]', ...args),
  error: (...args: unknown[]) => console.error('[error]', ...args)
};