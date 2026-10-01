import { createClient } from '@libsql/client';
import { readFileSync } from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * Migration 0009 adds a unique index on (story_id, operation_version), but the MAX()+1
 * numbering it replaced could race and leave duplicates behind. Without a dedupe step the
 * index build fails and the upgrade never completes; without running the stories-counter
 * backfill AFTER the dedupe, the counter lands below a renumbered row and the next insert
 * collides with it.
 *
 * The dedupe UPDATE is also executed verbatim (not a copy) against a scratch database, with
 * duplicate groups arranged to catch the two classic mistakes: renumbering per group instead
 * of per story (victims from different groups collide with each other), and keeping the wrong
 * row of a group.
 */

const API_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const MIGRATION_FILE = path.join(API_ROOT, 'drizzle', '0009_empty_stark_industries.sql');

const statements = () =>
  readFileSync(MIGRATION_FILE, 'utf8')
    .split('--> statement-breakpoint')
    .map((statement) => statement.trim())
    .filter((statement) => statement.length > 0);

describe('migration 0009 (operation_log unique index)', () => {
  it('dedupes before the backfill, and backfills before the unique index', () => {
    const parts = statements();
    const indexOf = (needle: string) => {
      const at = parts.findIndex((part) => part.includes(needle));
      expect(at, `missing statement containing: ${needle}`).toBeGreaterThanOrEqual(0);
      return at;
    };

    const dedupe = indexOf('UPDATE "operation_log"');
    const backfill = indexOf('UPDATE "stories"');
    const index = indexOf('CREATE UNIQUE INDEX "operation_log_story_id_operation_version_idx"');

    expect(dedupe).toBeLessThan(backfill);
    expect(backfill).toBeLessThan(index);
  });

  describe('dedupe statement, executed verbatim', () => {
    it('keeps one row per group and renumbers the rest above the max without colliding', async () => {
      const dedupe = statements().find((part) => part.includes('UPDATE "operation_log"'));
      expect(dedupe).toBeDefined();

      const client = createClient({ url: 'file::memory:' });
      try {
        await client.execute(
          'CREATE TABLE operation_log (id TEXT PRIMARY KEY, story_id TEXT NOT NULL, operation_version INTEGER NOT NULL)',
        );
        // Story A: a duplicate pair plus a higher clean row (the max victims must clear).
        // Story B: TWO duplicate groups, so per-group renumbering would collide the victims.
        // Ids sort with insertion order (ULIDs do), and the kept row is always MIN(id).
        await client.execute({
          sql: 'INSERT INTO operation_log (id, story_id, operation_version) VALUES (?, ?, ?)',
          args: ['a-keep', 'story-a', 2],
        });
        for (const [id, storyId, version] of [
          ['a-victim', 'story-a', 2],
          ['a-top', 'story-a', 5],
          ['b-keep-1', 'story-b', 1],
          ['b-victim-1', 'story-b', 1],
          ['b-keep-3', 'story-b', 3],
          ['b-victim-3', 'story-b', 3],
        ] as const) {
          await client.execute({
            sql: 'INSERT INTO operation_log (id, story_id, operation_version) VALUES (?, ?, ?)',
            args: [id, storyId, version],
          });
        }

        await client.execute(dedupe!);

        const versions = async (id: string) =>
          (
            await client.execute({
              sql: 'SELECT operation_version AS v FROM operation_log WHERE id = ?',
              args: [id],
            })
          ).rows[0]?.['v'];
        // Kept rows stay exactly where they were.
        expect(await versions('a-keep')).toBe(2);
        expect(await versions('a-top')).toBe(5);
        expect(await versions('b-keep-1')).toBe(1);
        expect(await versions('b-keep-3')).toBe(3);
        // Victims move strictly above the old max, each to its own version.
        const victimVersions = [
          await versions('a-victim'),
          await versions('b-victim-1'),
          await versions('b-victim-3'),
        ];
        expect(victimVersions[0]).toBeGreaterThan(5);
        expect(victimVersions[1]).toBeGreaterThan(3);
        expect(victimVersions[2]).toBeGreaterThan(3);
        expect(new Set(victimVersions).size).toBe(3);
        // And the state the unique index needs: no duplicates left anywhere.
        const dupes = await client.execute(
          'SELECT story_id, operation_version FROM operation_log GROUP BY story_id, operation_version HAVING COUNT(*) > 1',
        );
        expect(dupes.rows).toHaveLength(0);
      } finally {
        client.close();
      }
    });
  });
});
