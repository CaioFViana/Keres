import type { ServiceState } from '../../routes';
import { all } from '../../store/sql';

/**
 * What the queue shows of a sending, and nothing more: how long it has waited, which attempt it is, and the username
 * Keres gave. The ids are the sending's own (random), and carry nothing about the person.
 */

export interface QueueRow {
  id: string;
  username: string;
  waitingMinutes: number;
  /** 1 for the first sending of an account, 2 or more for a retry. */
  attempt: number;
  retry: boolean;
}

/** Retry chains are a handful long; the bound guards against a corrupt loop. */
const MAX_CHAIN = 100;

interface RawQueue {
  id: string;
  subject_username: string;
  uploaded_at: number | null;
  retry_of: string | null;
}

/** The attempt number of a sending, by walking its retry chain. */
export function attemptOf(state: ServiceState, retryOf: string | null): number {
  let attempt = 1;
  let reference = retryOf;
  for (let depth = 0; reference !== null && depth < MAX_CHAIN; depth += 1) {
    const previous = state.stores.submissions.byProviderReference(reference);
    if (!previous) break;
    attempt += 1;
    reference = previous.retryOf;
  }
  return attempt;
}

function rowsOf(state: ServiceState, now: number, raw: RawQueue[]): QueueRow[] {
  return raw.map((item) => ({
    id: item.id,
    username: item.subject_username,
    waitingMinutes: Math.max(0, Math.floor((now - (item.uploaded_at ?? now)) / 60_000)),
    attempt: attemptOf(state, item.retry_of),
    retry: item.retry_of !== null,
  }));
}

const COLUMNS = 'id, subject_username, uploaded_at, retry_of';

/** Sendings waiting for a claim, oldest first. Expired ones are left out: no decision could be made on them. */
export function waitingQueue(state: ServiceState, now: number): QueueRow[] {
  const raw = all<RawQueue>(
    state.stores.data,
    `SELECT ${COLUMNS} FROM submissions
     WHERE status = 'uploaded' AND expires_at > ?
     ORDER BY uploaded_at ASC, id ASC LIMIT 200`,
    now,
  );
  return rowsOf(state, now, raw);
}

/** The sendings this reviewer holds and has not decided yet, oldest first. */
export function heldBy(state: ServiceState, reviewerId: string, now: number): QueueRow[] {
  const raw = all<RawQueue>(
    state.stores.data,
    `SELECT ${COLUMNS} FROM submissions
     WHERE status = 'claimed' AND reviewer_id = ? AND expires_at > ?
     ORDER BY uploaded_at ASC, id ASC LIMIT 200`,
    reviewerId,
    now,
  );
  return rowsOf(state, now, raw);
}
