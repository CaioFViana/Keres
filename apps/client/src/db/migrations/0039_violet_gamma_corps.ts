import type { SQLiteDatabase } from 'expo-sqlite';

export default async function (db: SQLiteDatabase) {
  await db.execAsync(`
  ALTER TABLE "client_settings" ADD "export_format" text DEFAULT 'svg' NOT NULL;
`);
}
