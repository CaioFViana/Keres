type LogLevel = 'info' | 'warn' | 'error';

/** Turns a thrown value into a safely loggable object - pg errors carry a `.code` (e.g. ECONNREFUSED) worth keeping. */
function serializeError(error: unknown): Record<string, unknown> {
  if (error instanceof Error) {
    const code = (error as { code?: unknown }).code;
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
      ...(code !== undefined ? { code } : {}),
    };
  }
  return { message: String(error) };
}

function write(level: LogLevel, message: string, meta?: Record<string, unknown>) {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...(meta ? { meta } : {}),
  };
  const line = JSON.stringify(entry);
  if (level === 'error') {
    console.error(line);
  } else if (level === 'warn') {
    console.warn(line);
  } else {
    console.log(line);
  }
}

export const logger = {
  info: (message: string, meta?: Record<string, unknown>) => write('info', message, meta),
  warn: (message: string, meta?: Record<string, unknown>) => write('warn', message, meta),
  error: (message: string, error?: unknown, meta?: Record<string, unknown>) =>
    write('error', message, { ...(error !== undefined ? { error: serializeError(error) } : {}), ...meta }),
};
