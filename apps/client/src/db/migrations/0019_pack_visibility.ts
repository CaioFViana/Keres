import type { SQLiteDatabase } from 'expo-sqlite';

export default async function (db: SQLiteDatabase) {
  await db.execAsync(`
  ALTER TABLE "packs" ADD "visibility" text DEFAULT 'private' NOT NULL;
`);
}
