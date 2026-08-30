import { existsSync, readdirSync, readFileSync } from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * The migration folders and their journals describe the same set of files.
 *
 * Why this exists: a migration written by hand is legitimate here - `0004_add_plots` and
 * `0016_add_plots` both are - but drizzle-kit only writes a *snapshot* when it generates one
 * itself, and it diffs the schema against the highest snapshot that **exists**, not against the
 * last journal entry. So a hand-written migration with no snapshot silently leaves the snapshot
 * behind reality, and the next `db:generate` re-emits every change since then as a brand new
 * migration - which then fails on any database that already applied them.
 *
 * That has now happened three times in this repository, twice in one week, and each time it was
 * only noticed by someone running `db:generate` and reading the output carefully.
 *
 * **The recipe that avoids it**: never hand-write into these folders. Let `db:generate` produce the
 * SQL and the snapshot, then rename the file and its journal tag to something descriptive and trim
 * the SQL if the generator emitted more than the change at hand. The snapshot is the part that must
 * survive.
 */

const API_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

interface JournalEntry {
  idx: number;
  tag: string;
}

const FOLDERS = ['drizzle', 'drizzle-sqlite'] as const;

/**
 * Entries that predate this test and have no snapshot. Shrink-only: the list is compared with
 * `toEqual`, so a name that stays here after being regenerated fails just as loudly as a new one
 * appearing. Do not add to it - see the recipe above.
 */
const KNOWN_MISSING_SNAPSHOTS: Record<(typeof FOLDERS)[number], string[]> = {
  drizzle: ['0016_add_plots'],
  'drizzle-sqlite': ['0004_add_plots'],
};

function readJournal(folder: string): JournalEntry[] {
  const raw = readFileSync(path.join(API_ROOT, folder, 'meta', '_journal.json'), 'utf8');
  return (JSON.parse(raw) as { entries: JournalEntry[] }).entries;
}

const snapshotName = (idx: number) => `${String(idx).padStart(4, '0')}_snapshot.json`;

describe.each(FOLDERS)('%s', (folder) => {
  const entries = readJournal(folder);

  it('registers every migration file, and every registered migration exists', () => {
    const onDisk = readdirSync(path.join(API_ROOT, folder))
      .filter((file) => file.endsWith('.sql'))
      .map((file) => file.replace(/\.sql$/, ''))
      .sort();

    // A file with no entry is never applied; an entry with no file crashes the migrator on boot.
    expect(onDisk).toEqual(entries.map((entry) => entry.tag).sort());
  });

  it('keeps the journal in ascending order with no gaps', () => {
    expect(entries.map((entry) => entry.idx)).toEqual(entries.map((_, index) => index));
  });

  it('has a snapshot for every migration except the known hand-written ones', () => {
    const missing = entries
      .filter((entry) => !existsSync(path.join(API_ROOT, folder, 'meta', snapshotName(entry.idx))))
      .map((entry) => entry.tag)
      .sort();

    expect(missing).toEqual([...KNOWN_MISSING_SNAPSHOTS[folder]].sort());
  });

  /**
   * The one that actually protects `db:generate`: whatever is missing further back, the newest
   * migration must have a snapshot, because that is the file the next diff is taken against.
   */
  it('has a snapshot for the newest migration', () => {
    const newest = entries[entries.length - 1];
    expect(newest).toBeDefined();
    const snapshot = path.join(API_ROOT, folder, 'meta', snapshotName(newest!.idx));
    expect({ [newest!.tag]: existsSync(snapshot) }).toEqual({ [newest!.tag]: true });
  });
});
