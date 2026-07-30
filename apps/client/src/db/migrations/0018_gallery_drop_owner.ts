import { SQLiteDatabase } from 'expo-sqlite';

export default async function (db: SQLiteDatabase) {
  await db.execAsync(`
  CREATE TABLE "gallery_relations" (
	"id" text PRIMARY KEY NOT NULL,
	"story_id" text NOT NULL,
	"gallery_id" text NOT NULL,
	"owner_id" text NOT NULL,
	"owner_type" text NOT NULL,
	"created_at" integer NOT NULL,
	"updated_at" integer NOT NULL,
	"version" integer NOT NULL,
	"is_deleted" integer NOT NULL,
	"deleted_at" integer
);
--> statement-breakpoint
ALTER TABLE "galleries" DROP COLUMN "owner_id";--> statement-breakpoint
ALTER TABLE "galleries" DROP COLUMN "image_path";
`);
}
