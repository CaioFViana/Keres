import type { SQLiteDatabase } from 'expo-sqlite';

export default async function (db: SQLiteDatabase) {
  await db.execAsync(`
  ALTER TABLE "chapters" ADD "type" text DEFAULT 'chapter' NOT NULL;
`);
}
