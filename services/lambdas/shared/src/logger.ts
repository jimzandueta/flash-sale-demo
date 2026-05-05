type LogLevel = 'debug' | 'info' | 'error';

const levelPriority: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  error: 2
};

function getLogLevel(): LogLevel {
  const level = process.env.LOG_LEVEL;

  if (level === 'debug' || level === 'error') {
    return level;
  }

  return 'info';
}

function shouldLog(level: LogLevel) {
  return levelPriority[level] >= levelPriority[getLogLevel()];
}

export const logger = {
  debug: (...args: unknown[]) => {
    if (shouldLog('debug')) {
      console.log('[debug]', ...args);
    }
  },
  info: (...args: unknown[]) => {
    if (shouldLog('info')) {
      console.log('[info]', ...args);
    }
  },
  error: (...args: unknown[]) => {
    if (shouldLog('error')) {
      console.error('[error]', ...args);
    }
  }
};