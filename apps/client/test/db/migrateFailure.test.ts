/**
 * @jest-environment node
 */
jest.mock('../../src/db/migrations', () => ({
  __esModule: true,
  default: [
    { name: 'successful', run: jest.fn().mockResolvedValue(undefined) },
    { name: 'broken', run: jest.fn().mockRejectedValue(new Error('broken migration')) },
  ],
}));

import Database from 'better-sqlite3';

import { migrate } from '../../src/db/migrate';
import migrations from '../../src/db/migrations';

const [successful, broken] = migrations as unknown as {
  name: string;
  run: jest.Mock;
}[];

it('records only migrations that completed successfully when a later migration fails', async () => {
  const expoDb = {
    execAsync: jest.fn(),
    getAllAsync: jest.fn().mockResolvedValue([]),
    runAsync: jest.fn(),
  };
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});

  await expect(migrate(expoDb as never)).rejects.toThrow('broken migration');

  expect(successful.run).toHaveBeenCalledWith(expoDb);
  expect(broken.run).toHaveBeenCalledWith(expoDb);
  expect(expoDb.runAsync).toHaveBeenCalledTimes(1);
  expect(expoDb.runAsync).toHaveBeenCalledWith(
    'INSERT INTO _migrations (name) VALUES (?)',
    'successful',
  );
  expect(expoDb.runAsync).not.toHaveBeenCalledWith(
    'INSERT INTO _migrations (name) VALUES (?)',
    'broken',
  );
});

it('rolls a half-applied migration back so the relaunch starts clean', async () => {
  const raw = new Database(':memory:');
  // The link-repair step at the end of migrate() touches galleries on every boot.
  raw.exec(`CREATE TABLE galleries (media_type TEXT, upload_state TEXT, download_state TEXT);`);
  try {
    const expoDb = {
      execAsync: async (sql: string) => {
        raw.exec(sql);
      },
      getAllAsync: async <T>(sql: string): Promise<T[]> => raw.prepare(sql).all() as T[],
      runAsync: async (sql: string, ...params: unknown[]) => {
        raw.prepare(sql).run(...params);
      },
    };
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    broken.run.mockImplementationOnce(async () => {
      raw.exec(
        `CREATE TABLE half_applied (id INTEGER PRIMARY KEY); INSERT INTO half_applied (id) VALUES (1);`,
      );
      throw new Error('die mid-migration');
    });

    await expect(migrate(expoDb as never)).rejects.toThrow('die mid-migration');

    expect(
      raw
        .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='half_applied'`)
        .get(),
    ).toBeUndefined();
    expect(raw.prepare(`SELECT name FROM _migrations`).all()).toEqual([{ name: 'successful' }]);

    // Fixed and relaunched: no "already exists" from the rolled-back half.
    broken.run.mockImplementationOnce(async () => {
      raw.exec(`CREATE TABLE half_applied (id INTEGER PRIMARY KEY);`);
    });
    await migrate(expoDb as never);

    expect(
      raw
        .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='half_applied'`)
        .get(),
    ).toBeTruthy();
    expect(raw.prepare(`SELECT name FROM _migrations ORDER BY name`).all()).toEqual([
      { name: 'broken' },
      { name: 'successful' },
    ]);
  } finally {
    raw.close();
  }
});
