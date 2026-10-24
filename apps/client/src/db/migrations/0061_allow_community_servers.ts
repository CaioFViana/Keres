import type { SQLiteDatabase } from 'expo-sqlite';

export default async function (db: SQLiteDatabase) {
  await db.execAsync(`
  ALTER TABLE "client_settings" ADD "allow_community_servers" integer DEFAULT false NOT NULL;
`);
}
