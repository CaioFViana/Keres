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
