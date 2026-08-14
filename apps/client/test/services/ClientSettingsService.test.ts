/**
 * @jest-environment node
 */
import {
  createClientSettings,
  getClientSettings,
  updateClientSettings,
} from '../../src/services/ClientSettingsService';
import { createTestDatabase, type TestDatabase } from '../helpers/testDb';

let database: TestDatabase;

beforeEach(async () => {
  database = await createTestDatabase();
});

afterEach(() => database.close());

it('creates settings once and increments their version when updating them', async () => {
  expect(await getClientSettings(database.db)).toBeNull();

  const created = await createClientSettings(database.db, {
    localUsername: 'Caio',
    language: 'pt-BR',
    darkMode: false,
  });
  const updated = await updateClientSettings(database.db, { darkMode: true, language: 'en-US' });

  expect(updated).toEqual(
    expect.objectContaining({ id: created.id, darkMode: true, language: 'en-US', version: 2 }),
  );
  expect(await getClientSettings(database.db)).toEqual(expect.objectContaining({ id: created.id }));
});
