/**
 * @jest-environment node
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import migrations from '../../src/db/migrations/index';

/**
 * The three views of a client migration agree: the SQL, the generated module, and the index.
 *
 * The client does not run drizzle's migrator. `scripts/lib/migrationsIndex.ts` scans `drizzle/*.sql`
 * at build time, writes one `.ts` per file and an index, and `src/db/migrate.ts` applies whatever is
 * in that index, keyed by **name** in the `_migrations` table.
 *
 * Two ways to break it, both of which have happened:
 *
 * - **Writing the `.ts` by hand.** The generator never sees it, the index never lists it, and the
 *   migration silently never runs - which shows up much later as `no such column`.
 * - **Letting `db:generate` loose on the folder.** Its snapshot lags behind every hand-written
 *   migration, so it re-emits them as one new file. That file then *does* get a module and an index
 *   entry, and creates tables that already exist.
 *
 * The drizzle journal here is only used by `db:generate`; it is checked because a journal that has
 * fallen behind the folder is exactly the state that produces the second failure.
 */

const CLIENT_ROOT = join(__dirname, '..', '..');
const DRIZZLE_DIR = join(CLIENT_ROOT, 'drizzle');
const MODULES_DIR = join(CLIENT_ROOT, 'src', 'db', 'migrations');

const sqlNames = () =>
  readdirSync(DRIZZLE_DIR)
    .filter((file) => file.endsWith('.sql'))
    .map((file) => file.replace(/\.sql$/, ''))
    .sort();

describe('client migrations', () => {
  it('generates one module per SQL file, and nothing else', () => {
    const modules = readdirSync(MODULES_DIR)
      .filter((file) => file.endsWith('.ts') && file !== 'index.ts')
      .map((file) => file.replace(/\.ts$/, ''))
      .sort();

    // A module with no SQL was written by hand; a SQL with no module means the generator has not run.
    expect(modules).toEqual(sqlNames());
  });

  it('lists every migration in the index, in file order', () => {
    expect(migrations.map((migration) => migration.name)).toEqual(sqlNames());
  });

  it('numbers the index entries without gaps', () => {
    expect(migrations.map((migration) => migration.id)).toEqual(
      migrations.map((_, index) => index + 1),
    );
  });

  it('never repeats a migration name', () => {
    // `_migrations` is keyed by name, so a duplicate would make the second one silently skipped.
    expect(new Set(migrations.map((migration) => migration.name)).size).toBe(migrations.length);
  });

  /**
   * `db:generate` diffs against the highest snapshot that exists, so a journal that has fallen
   * behind the folder is what makes it re-emit migrations that already ran.
   */
  it('keeps the drizzle journal level with the folder', () => {
    const journalPath = join(DRIZZLE_DIR, 'meta', '_journal.json');
    const entries = (
      JSON.parse(readFileSync(journalPath, 'utf8')) as { entries: { idx: number; tag: string }[] }
    ).entries;

    expect(entries.map((entry) => entry.tag).sort()).toEqual(sqlNames());

    const newest = entries[entries.length - 1];
    const snapshot = join(
      DRIZZLE_DIR,
      'meta',
      `${String(newest!.idx).padStart(4, '0')}_snapshot.json`,
    );
    expect({ [newest!.tag]: existsSync(snapshot) }).toEqual({ [newest!.tag]: true });
  });
});
