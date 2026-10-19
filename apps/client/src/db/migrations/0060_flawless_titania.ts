import type { SQLiteDatabase } from 'expo-sqlite';

export default async function (db: SQLiteDatabase) {
  await db.execAsync(`
  ALTER TABLE "servers" ADD "privacy_text" text;--> statement-breakpoint
ALTER TABLE "servers" ADD "privacy_version" text;--> statement-breakpoint
ALTER TABLE "servers" ADD "privacy_accepted_at" integer;
`);
}
