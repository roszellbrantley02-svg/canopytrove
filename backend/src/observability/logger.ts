type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const SEVERITY_MAP: Record<LogLevel, string> = {
  debug: 'DEBUG',
  info: 'INFO',
  warn: 'WARNING',
  error: 'ERROR',
};

function writeLog(level: LogLevel, message: string, context?: Record<string, unknown>) {
  const entry = {
    severity: SEVERITY_MAP[level],
    message,
    timestamp: new Date().toISOString(),
    ...context,
  };
  // Cloud Run parses JSON on stdout as structured logs
  if (level === 'error') {
    console.error(JSON.stringify(entry));
  } else {
    console.log(JSON.stringify(entry));
  }
}

export const logger = {
  debug: (message: string, context?: Record<string, unknown>) =>
    writeLog('debug', message, context),
  info: (message: string, context?: Record<string, unknown>) => writeLog('info', message, context),
  warn: (message: string, context?: Record<string, unknown>) => writeLog('warn', message, context),
  error: (message: string, context?: Record<string, unknown>) =>
    writeLog('error', message, context),
};
