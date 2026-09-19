import type { SQLiteDatabase } from 'expo-sqlite';

export default async function (db: SQLiteDatabase) {
  await db.execAsync(`
  ALTER TABLE "client_settings" ADD "show_tutorials" integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "client_settings" ADD "seen_tutorials" text DEFAULT '{"version":1,"seen":[]}' NOT NULL;
`);
}
