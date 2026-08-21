import { SQLiteDatabase } from 'expo-sqlite';

export default async function (db: SQLiteDatabase) {
  await db.execAsync(`
  ALTER TABLE "client_settings" ADD "show_contextual_help" integer DEFAULT true NOT NULL;
`);
}
