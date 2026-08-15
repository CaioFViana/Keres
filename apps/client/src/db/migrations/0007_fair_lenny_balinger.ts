import { SQLiteDatabase } from 'expo-sqlite';

export default async function (db: SQLiteDatabase) {
  await db.execAsync(`
  ALTER TABLE "client_settings" ADD "use_24_hour_time" integer DEFAULT true NOT NULL;
`);
}
