import { SQLiteDatabase } from 'expo-sqlite';

export default async function (db: SQLiteDatabase) {
  await db.execAsync(`
  ALTER TABLE "character_relations" RENAME COLUMN "char_id_1" TO "character1_id";--> statement-breakpoint
ALTER TABLE "character_relations" RENAME COLUMN "char_id_2" TO "character2_id";

`);
}
