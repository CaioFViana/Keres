import { SQLiteDatabase } from 'expo-sqlite';

export default async function (db: SQLiteDatabase) {
  await db.execAsync(`
  ALTER TABLE "stories" ADD COLUMN "normalize_scene_timing" integer NOT NULL DEFAULT 0;

`);
}
