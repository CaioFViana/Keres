/**
 * @jest-environment node
 */
import { rankAtPosition } from '@keres/shared';
import { createTestDatabase, type TestDatabase } from '../helpers/testDb';

let database: TestDatabase;

beforeEach(async () => {
  database = await createTestDatabase();
});

afterEach(() => database.close());

const insertScene = (id: string, chapterId: string | null, index: number, rank = '') =>
  database.raw
    .prepare(
      `INSERT INTO scenes (id, story_id, chapter_id, name, "index", rank, created_at, updated_at, version, is_deleted)
       VALUES (?, 'story', ?, ?, ?, ?, 0, 0, 1, 0)`,
    )
    .run(id, chapterId, id, index, rank);

const scenesOf = (chapterId: string | null) =>
  database.raw
    .prepare<[string | null], { id: string; index: number; rank: string }>(
      `SELECT id, "index", rank FROM scenes WHERE chapter_id IS ? AND is_deleted = 0 ORDER BY "index"`,
    )
    .all(chapterId);

/**
 * The positions everything reads (`index`, `order`) are derived from ranks by the database itself,
 * so no write path - a service, a pulled operation, a resolution, an import - can leave them stale.
 */
describe('rank triggers', () => {
  it('gives a row without a rank the key its legacy position implies, as rules/rank.ts does', () => {
    const insert = database.raw.prepare(
      `INSERT INTO scenes (id, story_id, chapter_id, name, "index", created_at, updated_at, version, is_deleted)
       VALUES (?, 'story', ?, 'scene', ?, 0, 0, 1, 0)`,
    );
    const positions = [0, 1, 9, 10, 35, 36, 61, 62, 63, 123, 124, 3905, 3906, 3907, 5000, 250000];
    for (const position of positions) insert.run(`s${position}`, `c${position}`, position);
    const ranks = database.raw
      .prepare<[], { id: string; rank: string }>('SELECT id, rank FROM scenes')
      .all();
    for (const row of ranks) {
      const position = Number(row.id.slice(1));
      expect([position, row.rank]).toEqual([position, rankAtPosition(Math.min(position, 242233))]);
    }
  });

  it('numbers a container from its ranks on every insert, move, rank change and deletion', () => {
    insertScene('a', 'c1', 7, 'a5');
    insertScene('b', 'c1', 1, 'a3');
    insertScene('c', 'c1', 1, 'a3');
    expect(scenesOf('c1').map((row) => [row.id, row.index])).toEqual([
      ['b', 1],
      ['c', 2],
      ['a', 3],
    ]);

    database.raw.prepare(`UPDATE scenes SET rank = 'a1' WHERE id = 'a'`).run();
    expect(scenesOf('c1').map((row) => row.id)).toEqual(['a', 'b', 'c']);

    database.raw.prepare(`UPDATE scenes SET chapter_id = 'c2' WHERE id = 'b'`).run();
    expect(scenesOf('c1').map((row) => [row.id, row.index])).toEqual([
      ['a', 1],
      ['c', 2],
    ]);
    expect(scenesOf('c2').map((row) => [row.id, row.index])).toEqual([['b', 1]]);

    database.raw.prepare(`UPDATE scenes SET is_deleted = 1 WHERE id = 'a'`).run();
    expect(scenesOf('c1').map((row) => [row.id, row.index])).toEqual([['c', 1]]);
    // A deleted row holds no place: 0 for an index, as on the server.
    expect(database.raw.prepare(`SELECT "index" FROM scenes WHERE id = 'a'`).get()).toEqual({
      index: 0,
    });

    insertScene('loose', null, 4, 'a2');
    expect(scenesOf(null).map((row) => [row.id, row.index])).toEqual([['loose', 1]]);
  });

  it('numbers stats from zero and chapters per kind', () => {
    const stat = database.raw.prepare(
      `INSERT INTO stats (id, story_id, name, rank, created_at, updated_at, version) VALUES (?, 'story', ?, ?, 0, 0, 1)`,
    );
    stat.run('x', 'x', 'a2');
    stat.run('y', 'y', 'a1');
    expect(database.raw.prepare('SELECT id, "order" FROM stats ORDER BY "order"').all()).toEqual([
      { id: 'y', order: 0 },
      { id: 'x', order: 1 },
    ]);

    const chapter = database.raw.prepare(
      `INSERT INTO chapters (id, story_id, name, "index", type, rank, created_at, updated_at, version, is_deleted)
       VALUES (?, 'story', ?, 9, ?, ?, 0, 0, 1, 0)`,
    );
    chapter.run('ch1', 'ch1', 'chapter', 'a2');
    chapter.run('ev1', 'ev1', 'event', 'a1');
    chapter.run('ch2', 'ch2', 'chapter', 'a1');
    expect(
      database.raw.prepare('SELECT id, "index" FROM chapters ORDER BY type, "index"').all(),
    ).toEqual([
      { id: 'ch2', index: 1 },
      { id: 'ch1', index: 2 },
      { id: 'ev1', index: 1 },
    ]);
  });
});
