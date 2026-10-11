import type { SQLiteDatabase } from 'expo-sqlite';

export default async function (db: SQLiteDatabase) {
  await db.execAsync(`
  ALTER TABLE "scene_pages" ADD "spread" integer DEFAULT false NOT NULL;
`);
}
