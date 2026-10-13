import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from 'node:fs';
import { dirname } from 'node:path';
import { env } from '../config/env';

/**
 * The erasure ledger: what the server must not forget when a backup is restored.
 *
 * A dump is the past. Restore one and the accounts deleted since come back with it - an erasure the person was
 * promised would be undone. The ledger is the answer: every deletion, restoration and final erasure of an
 * account is appended here, to a file that lives OUTSIDE every backup (its own volume, never mounted by the
 * backup service), and at boot the server applies it again to whatever database it finds (`applyErasureLedger`).
 *
 * It holds the account's id (a ULID, which no longer resolves to anyone once the account is erased), the kind of
 * event and the instant. No name, no address, no content. Lines older than `ERASURE_LEDGER_RETENTION_DAYS` are
 * dropped: the oldest backup is 93 days old, so a line is only needed that long.
 *
 * Writing never fails the erasure it describes: the person's deletion matters more than the line, and a failure
 * is said loudly on the console instead (the technical log writes through the database too).
 */

export const ERASURE_KINDS = ['account_deleted', 'account_restored', 'account_erased'] as const;
export type ErasureKind = (typeof ERASURE_KINDS)[number];

export interface ErasureEntry {
  at: string;
  kind: ErasureKind;
  userId: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function isEntry(value: unknown): value is ErasureEntry {
  if (!value || typeof value !== 'object') return false;
  const entry = value as Record<string, unknown>;
  return (
    typeof entry.at === 'string' &&
    !Number.isNaN(Date.parse(entry.at)) &&
    typeof entry.userId === 'string' &&
    entry.userId.length > 0 &&
    (ERASURE_KINDS as readonly string[]).includes(entry.kind as string)
  );
}

export class ErasureLedger {
  /** `path` is read on every call so a test (or a changed environment) is honoured without a rebuild. */
  constructor(private readonly pathOf: () => string | undefined = () => env.ERASURE_LEDGER_PATH) {}

  get enabled(): boolean {
    return !!this.pathOf();
  }

  /** Appends a line. Synchronous on purpose: the line must be on disk before the erasure is reported done. */
  record(kind: ErasureKind, userId: string, at: Date = new Date()): void {
    const path = this.pathOf();
    if (!path) return;
    try {
      mkdirSync(dirname(path), { recursive: true });
      appendFileSync(path, `${JSON.stringify({ at: at.toISOString(), kind, userId })}\n`, 'utf8');
    } catch (error) {
      console.error('Failed to write the erasure ledger', error);
    }
  }

  /** Every readable line, oldest first. A damaged line is skipped, not fatal. */
  read(): ErasureEntry[] {
    const path = this.pathOf();
    if (!path || !existsSync(path)) return [];
    const entries: ErasureEntry[] = [];
    for (const line of readFileSync(path, 'utf8').split('\n')) {
      if (!line.trim()) continue;
      try {
        const parsed: unknown = JSON.parse(line);
        if (isEntry(parsed)) entries.push(parsed);
      } catch {
        // A half-written last line (a crash mid-append) is not worth stopping the server for.
      }
    }
    return entries;
  }

  /** What each account last had done to it - the state the database must be in. */
  latestPerUser(): ErasureEntry[] {
    const latest = new Map<string, ErasureEntry>();
    for (const entry of this.read()) latest.set(entry.userId, entry);
    return [...latest.values()];
  }

  /** Drops the lines older than `days` (rewritten through a temporary file). Returns how many went. */
  trim(now: Date = new Date(), days: number = env.ERASURE_LEDGER_RETENTION_DAYS): number {
    const path = this.pathOf();
    if (!path || !existsSync(path)) return 0;
    const cutoff = now.getTime() - days * DAY_MS;
    const all = this.read();
    const kept = all.filter((entry) => Date.parse(entry.at) >= cutoff);
    if (kept.length === all.length) return 0;
    const temporary = `${path}.tmp`;
    writeFileSync(temporary, kept.map((entry) => `${JSON.stringify(entry)}\n`).join(''), 'utf8');
    renameSync(temporary, path);
    return all.length - kept.length;
  }
}

export const erasureLedger = new ErasureLedger();
