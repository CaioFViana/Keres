import { eq } from 'drizzle-orm';
import type { AppDrizzleClient, ClientSettingsInsert, ClientSettingsSelect } from '../db';
import { schema } from '../db';
import { createULID } from '../utils/entityUtils';

export async function getClientSettings(
  db: AppDrizzleClient,
): Promise<ClientSettingsSelect | null> {
  if (!db) {
    throw new Error('getClientSettings: Drizzle client (db) is undefined.');
  }
  const settings = await db.select().from(schema.clientSettings).limit(1).get();
  return settings || null;
}

export async function createClientSettings(
  db: AppDrizzleClient,
  initialSettings: Omit<
    ClientSettingsInsert,
    'id' | 'createdAt' | 'updatedAt' | 'version' | 'isDeleted' | 'deletedAt'
  >,
): Promise<ClientSettingsSelect> {
  if (!db) {
    throw new Error('createClientSettings: Drizzle client (db) is undefined.');
  }
  const newSettings: ClientSettingsInsert = {
    id: createULID(), // Generate ID internally
    ...initialSettings,
    createdAt: new Date(),
    updatedAt: new Date(),
    version: 1,
    isDeleted: false,
    deletedAt: null,
  };
  const [created] = await db.insert(schema.clientSettings).values(newSettings).returning();
  return created;
}

export async function updateClientSettings(
  db: AppDrizzleClient,
  newValues: Partial<ClientSettingsInsert>,
): Promise<ClientSettingsSelect> {
  if (!db) {
    throw new Error('updateClientSettings: Drizzle client (db) is undefined.');
  }
  const currentSettings = await getClientSettings(db); // Pass db to getClientSettings
  if (!currentSettings) {
    throw new Error('Client settings not found. Cold install required.');
  }
  const updatedSettings: ClientSettingsInsert = {
    ...currentSettings,
    ...newValues,
    updatedAt: new Date(),
    version: currentSettings.version + 1,
  };
  const [updated] = await db
    .update(schema.clientSettings)
    .set(updatedSettings)
    .where(eq(schema.clientSettings.id, currentSettings.id))
    .returning();
  return updated;
}
