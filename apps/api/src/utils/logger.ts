type LogLevel = 'info' | 'warn' | 'error';

type LogSink = (entry: {
  level: LogLevel;
  message: string;
  meta?: Record<string, unknown>;
  timestamp: string;
}) => void;

let sink: LogSink | null = null;

/** Registered by `server.ts` after the migrations run - see the comment there for why. */
export function setLogSink(fn: LogSink) {
  sink = fn;
}

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
  if (sink) {
    try {
      sink(entry);
    } catch {
      // It never lets a persistence failure take down whoever called the logger.
    }
  }
}

export const logger = {
  info: (message: string, meta?: Record<string, unknown>) => write('info', message, meta),
  warn: (message: string, meta?: Record<string, unknown>) => write('warn', message, meta),
  error: (message: string, error?: unknown, meta?: Record<string, unknown>) =>
    write('error', message, {
      ...(error !== undefined ? { error: serializeError(error) } : {}),
      ...meta,
    }),
};
