import type { SQLiteDatabase } from 'expo-sqlite';

export default async function (db: SQLiteDatabase) {
  await db.execAsync(`
  ALTER TABLE "servers" ADD "tos_text" text;
ALTER TABLE "servers" ADD "tos_version" text;
ALTER TABLE "servers" ADD "tos_accepted_at" integer;

`);
}
