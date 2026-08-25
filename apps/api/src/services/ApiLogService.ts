import { ulid } from 'ulid';
import { db } from '../db';
import { apiLogs } from '../db/schema';
import { isForeignKeyConstraint } from '../utils/errors';

type LogLevel = 'info' | 'warn' | 'error';

interface LogEntry {
  level: LogLevel;
  message: string;
  meta?: Record<string, unknown>;
  timestamp: string;
}

/**
 * Extracts `userId`/`storyId` from `meta` when they are present as strings - a convention most of the
 * logger's call sites already follow (see `webSocket.route.ts`/`sync.route.ts`).
 */
function extractStringField(meta: Record<string, unknown> | undefined, key: string): string | null {
  const value = meta?.[key];
  return typeof value === 'string' ? value : null;
}

function rowFromEntry(
  entry: LogEntry,
  userId: string | null,
  storyId: string | null,
): typeof apiLogs.$inferInsert {
  return {
    id: ulid(),
    level: entry.level,
    message: entry.message,
    meta: entry.meta ?? null,
    userId,
    storyId,
    createdAt: new Date(entry.timestamp),
  };
}

/**
 * The sink for `utils/logger.ts` - registered by `server.ts` after the migrations run. It never calls
 * `logger.*` in its own catch (that would recurse back into the sink); it uses raw `console.error`
 * only, and never lets a persistence failure propagate back to whoever originated the log (the
 * logger's `write()` already wraps this call in a try/catch for safety, but the body itself does not
 * throw either).
 */
export async function persistApiLog(entry: LogEntry): Promise<void> {
  const userId = extractStringField(entry.meta, 'userId');
  const storyId = extractStringField(entry.meta, 'storyId');
  try {
    await db.insert(apiLogs).values(rowFromEntry(entry, userId, storyId));
  } catch (error) {
    // `userId`/`storyId` come from the meta (and, on a 401, from the URL's params) - they can point at
    // rows this server has never seen. Without the FKs that no longer happens; the retry covers a database
    // that has not yet run the migration that removed them.
    if ((userId || storyId) && isForeignKeyConstraint(error)) {
      try {
        await db.insert(apiLogs).values(rowFromEntry(entry, null, null));
        return;
      } catch (retryError) {
        console.error('Failed to persist API log entry', retryError);
        return;
      }
    }
    console.error('Failed to persist API log entry', error);
  }
}
