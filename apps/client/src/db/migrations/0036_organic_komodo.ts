import type { SQLiteDatabase } from 'expo-sqlite';

export default async function (db: SQLiteDatabase) {
  await db.execAsync(`
  ALTER TABLE "scenes" ADD "calendar_date_override" text;--> statement-breakpoint
ALTER TABLE "scenes" ADD "calendar_date_override_calendar_id" text;
`);
}
