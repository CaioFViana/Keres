import { VerificationEventWireSchema, type VerificationEventWire } from '@keres/shared';
import type { Database } from './sql';
import { all, one } from './sql';

/**
 * The events the service owes Keres, kept until Keres answers 2xx. An event is written in the same transaction as the
 * decision it reports, so a decision without its event (or an event without its decision) cannot be stored. The
 * `eventId` is deterministic per (submission, outcome): enqueuing the same outcome twice stores one row.
 */

export interface OutboxRow {
  id: number;
  eventId: string;
  payloadJson: string;
  attempts: number;
}

export class EventOutbox {
  constructor(private readonly db: Database) {}

  /**
   * Stores the event, once per `eventId`. The payload is checked against the wire schema first, so nothing the
   * service cannot say to Keres is ever queued. Returns `false` when the event was already queued.
   */
  enqueue(event: VerificationEventWire, now: number): boolean {
    const checked = VerificationEventWireSchema.parse(event);
    const result = this.db
      .prepare(
        'INSERT OR IGNORE INTO event_outbox (event_id, payload_json, created_at, attempts, next_attempt_at) VALUES (?, ?, ?, 0, ?)',
      )
      .run(checked.eventId, JSON.stringify(checked), now, now);
    return result.changes > 0;
  }

  /** The event with this id as it was queued, if any: the status answer repeats a decided event this way. */
  payloadOf(eventId: string): VerificationEventWire | undefined {
    const raw = one<{ payload_json: string }>(
      this.db,
      'SELECT payload_json FROM event_outbox WHERE event_id = ?',
      eventId,
    );
    return raw && (JSON.parse(raw.payload_json) as VerificationEventWire);
  }

  /** Undelivered events whose next attempt is due, oldest first. */
  due(now: number, limit: number): OutboxRow[] {
    return all<{ id: number; event_id: string; payload_json: string; attempts: number }>(
      this.db,
      `SELECT id, event_id, payload_json, attempts FROM event_outbox
       WHERE delivered_at IS NULL AND next_attempt_at <= ?
       ORDER BY id LIMIT ?`,
      now,
      limit,
    ).map((raw) => ({
      id: raw.id,
      eventId: raw.event_id,
      payloadJson: raw.payload_json,
      attempts: raw.attempts,
    }));
  }

  markDelivered(ids: readonly number[], now: number): void {
    const statement = this.db.prepare('UPDATE event_outbox SET delivered_at = ? WHERE id = ?');
    for (const id of ids) statement.run(now, id);
  }

  /** Counts one more failed attempt for each row and schedules the next one `delayMs(attempts)` later. */
  markFailed(
    rows: readonly Pick<OutboxRow, 'id' | 'attempts'>[],
    now: number,
    delayMs: (attempts: number) => number,
  ): void {
    const statement = this.db.prepare(
      'UPDATE event_outbox SET attempts = ?, next_attempt_at = ? WHERE id = ?',
    );
    for (const row of rows) {
      const attempts = row.attempts + 1;
      statement.run(attempts, now + delayMs(attempts), row.id);
    }
  }

  /** How many events are still owed, for the boot log and the tests. */
  undeliveredCount(): number {
    return (
      one<{ n: number }>(
        this.db,
        'SELECT COUNT(*) AS n FROM event_outbox WHERE delivered_at IS NULL',
      )?.n ?? 0
    );
  }
}
