import { SQLiteDatabase } from 'expo-sqlite';

export default async function (db: SQLiteDatabase) {
  await db.execAsync(`
  ALTER TABLE "friendships" DROP COLUMN "version";--> statement-breakpoint
ALTER TABLE "friendships" DROP COLUMN "is_deleted";--> statement-breakpoint
ALTER TABLE "friendships" DROP COLUMN "deleted_at";
`);
}
