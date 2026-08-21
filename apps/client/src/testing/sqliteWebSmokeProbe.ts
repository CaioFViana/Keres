import { drizzle } from 'drizzle-orm/expo-sqlite';
import type { SQLiteDatabase } from 'expo-sqlite';
import { Platform } from 'react-native';
import * as schema from '../db/schema';
import { createStoryService } from '../services/storymanagement/StoryService';

const RESULT_KEY = '__KERES_SQLITE_WEB_SMOKE_RESULT__';

type SmokeResult =
  | {
      status: 'passed';
      payloadLength: number;
      errorMessage: string;
      importedStoryId: string;
    }
  | { status: 'failed'; message: string };

function publishResult(result: SmokeResult): void {
  globalThis[RESULT_KEY] = result;
  // contextIsolation gives Electron's executeJavaScript a separate global object. The DOM is
  // shared, so it is the reliable hand-off channel from the React renderer to the test runner.
  document.documentElement.dataset.keresSqliteWebSmoke = JSON.stringify(result);
}

declare global {
  // The desktop smoke runner reads this from the isolated renderer once the probe finishes.
  // It only exists in an export explicitly built with EXPO_PUBLIC_SQLITE_WEB_SMOKE_TEST=true.
  var __KERES_SQLITE_WEB_SMOKE_RESULT__: SmokeResult | undefined;
}

export const shouldRunSqliteWebSmokeProbe =
  Platform.OS === 'web' && process.env.EXPO_PUBLIC_SQLITE_WEB_SMOKE_TEST === 'true';

/**
 * Exercises the synchronous Web Worker channel used by expo-sqlite in Electron.
 *
 * The long result detects a broken Uint32 response length (the original upstream bug); the
 * invalid query verifies that SQLite errors keep their actual message across that same channel.
 * This is deliberately a build-time test switch, never enabled in a normal client export.
 */
export async function runSqliteWebSmokeProbe(database: SQLiteDatabase): Promise<void> {
  const payload = 'keres-sqlite-web-'.repeat(96);
  const sourceStoryId = '01ARZ3NDEKTSV4RRFFQ69G5FAV';
  const importedStoryId = '01ARZ3NDEKTSV4RRFFQ69G5FAW';
  const userId = '01ARZ3NDEKTSV4RRFFQ69G5FAX';

  try {
    await database.execAsync(
      'CREATE TABLE IF NOT EXISTS _sqlite_web_smoke (id INTEGER PRIMARY KEY, payload TEXT NOT NULL);',
    );
    await database.runAsync('DELETE FROM _sqlite_web_smoke;');
    await database.runAsync('INSERT INTO _sqlite_web_smoke (payload) VALUES (?);', payload);

    const row = await database.getFirstAsync<{ payload: string }>(
      'SELECT payload FROM _sqlite_web_smoke WHERE id = 1;',
    );
    if (row?.payload !== payload) {
      throw new Error('The SQLite Web Worker returned a truncated long result.');
    }

    let errorMessage = '';
    try {
      await database.getAllAsync('SELECT * FROM _sqlite_web_smoke_missing_table;');
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : String(error);
    }
    if (!/no such table/i.test(errorMessage)) {
      throw new Error(`The SQLite Web Worker lost the SQL error message: ${errorMessage}`);
    }

    const db = drizzle(database, { schema });
    const stories = createStoryService(db);
    await db.insert(schema.stories).values({
      id: sourceStoryId,
      userId,
      title: 'História de origem',
      type: 'linear',
      favoriteBehavior: 'individual',
      createdAt: new Date(),
      updatedAt: new Date(),
      version: 1,
      isDeleted: false,
    });
    // This orphan is the failure mode importFullStory defends against. The real async SQLite
    // transaction must remove it before inserting the package with the same story id.
    await db.insert(schema.storySchemaFields).values({
      id: '01ARZ3NDEKTSV4RRFFQ69G5FAY',
      storyId: importedStoryId,
      entityType: 'Character',
      name: 'Sobrou de uma importação interrompida',
      key: 'stale-field',
      type: 'text',
      isRequired: false,
      order: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
      version: 1,
      isDeleted: false,
    });
    const exported = await stories.exportFullStory(sourceStoryId);
    const imported = await stories.importFullStory(
      userId,
      { ...exported, story: { ...exported.story, id: importedStoryId } },
      null,
    );
    const stored = await db.query.stories.findFirst({
      where: (story, { eq }) => eq(story.id, importedStoryId),
    });
    const staleField = await db.query.storySchemaFields.findFirst({
      where: (field, { eq }) => eq(field.id, '01ARZ3NDEKTSV4RRFFQ69G5FAY'),
    });
    if (imported !== importedStoryId || !stored || staleField) {
      throw new Error('Story import did not atomically replace its stale local data.');
    }

    publishResult({
      status: 'passed',
      payloadLength: payload.length,
      errorMessage,
      importedStoryId,
    });
  } catch (error) {
    publishResult({
      status: 'failed',
      message: error instanceof Error ? error.message : String(error),
    });
    throw error;
  } finally {
    await database.execAsync('DROP TABLE IF EXISTS _sqlite_web_smoke;');
  }
}
