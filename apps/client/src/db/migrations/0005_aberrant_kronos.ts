import { SQLiteDatabase } from 'expo-sqlite';

export default async function (db: SQLiteDatabase) {
  await db.execAsync(`
  ALTER TABLE "stories" ADD "last_operation_log" integer;--> statement-breakpoint
ALTER TABLE "stories" ADD "last_server_synced_log" integer;
`);
}
