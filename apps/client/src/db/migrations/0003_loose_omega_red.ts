import { SQLiteDatabase } from 'expo-sqlite';

export default async function (db: SQLiteDatabase) {
  await db.execAsync(`
  ALTER TABLE "servers" DROP COLUMN "jwt_token";--> statement-breakpoint
ALTER TABLE "servers" DROP COLUMN "refresh_token";
`);
}
