import { SQLiteDatabase } from 'expo-sqlite';

export default async function (db: SQLiteDatabase) {
  await db.execAsync(`
  CREATE TABLE "servers" (
	"id" text PRIMARY KEY NOT NULL,
	"id_user" text NOT NULL,
	"user_name" text NOT NULL,
	"name" text NOT NULL,
	"url" text NOT NULL,
	"last_sync_date" integer,
	"api_key" text NOT NULL,
	"created_at" integer NOT NULL,
	"updated_at" integer NOT NULL,
	"version" integer NOT NULL,
	"is_deleted" integer NOT NULL,
	"deleted_at" integer
);
--> statement-breakpoint
CREATE TABLE "story_permissions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"story_id" text NOT NULL,
	"server_id" text NOT NULL,
	"permission" text NOT NULL,
	"created_at" integer NOT NULL,
	"updated_at" integer NOT NULL,
	"version" integer NOT NULL,
	"is_deleted" integer NOT NULL,
	"deleted_at" integer
);
--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE "__new_users" (
	"id_user" text PRIMARY KEY NOT NULL,
	"id_server" text NOT NULL,
	"display_name" text,
	"created_at" integer NOT NULL,
	"updated_at" integer NOT NULL,
	"version" integer NOT NULL,
	"is_deleted" integer NOT NULL,
	"deleted_at" integer
);
--> statement-breakpoint
INSERT INTO "__new_users"("id_user", "id_server", "display_name", "created_at", "updated_at", "version", "is_deleted", "deleted_at") SELECT "id_user", "id_server", "display_name", "created_at", "updated_at", "version", "is_deleted", "deleted_at" FROM "users";--> statement-breakpoint
DROP TABLE "users";--> statement-breakpoint
ALTER TABLE "__new_users" RENAME TO "users";--> statement-breakpoint
PRAGMA foreign_keys=ON;
`);
}
