import { ulid } from 'ulid';
import { db } from '../db';
import { apiLogs } from '../db/schema';

type LogLevel = 'info' | 'warn' | 'error';

interface LogEntry {
  level: LogLevel;
  message: string;
  meta?: Record<string, unknown>;
  timestamp: string;
}

/** Extrai `userId`/`storyId` do `meta` quando presentes como string - convenção que a
 * maioria dos call sites do logger já segue (ver `webSocket.route.ts`/`sync.route.ts`). */
function extractStringField(meta: Record<string, unknown> | undefined, key: string): string | null {
  const value = meta?.[key];
  return typeof value === 'string' ? value : null;
}

/**
 * Sink de `utils/logger.ts` - registrado por `server.ts` depois das migrações rodarem.
 * Nunca chama `logger.*` no próprio catch (isso recursaria de volta pro sink); usa apenas
 * `console.error` bruto, e nunca deixa uma falha de persistência propagar de volta pra quem
 * originou o log (o `write()` do logger já embrulha esta chamada num try/catch por
 * segurança, mas o próprio corpo também não lança).
 */
export async function persistApiLog(entry: LogEntry): Promise<void> {
  try {
    await db.insert(apiLogs).values({
      id: ulid(),
      level: entry.level,
      message: entry.message,
      meta: entry.meta ?? null,
      userId: extractStringField(entry.meta, 'userId'),
      storyId: extractStringField(entry.meta, 'storyId'),
      createdAt: new Date(entry.timestamp),
    });
  } catch (error) {
    console.error('Failed to persist API log entry', error);
  }
}
