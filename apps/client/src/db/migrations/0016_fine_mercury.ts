import { SQLiteDatabase } from 'expo-sqlite';

export default async function (db: SQLiteDatabase) {
  await db.execAsync(`
  ALTER TABLE "scenes" ADD "is_start" integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "scenes" ADD "is_finish" integer DEFAULT false NOT NULL;
`);
}
