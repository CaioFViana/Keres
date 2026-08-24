import type { SQLiteDatabase } from 'expo-sqlite';

export default async function (db: SQLiteDatabase) {
  await db.execAsync(`
  ALTER TABLE "friendships" ADD "blocked_by_id" text REFERENCES users(id_user);
`);
}
