import { SQLiteDatabase } from 'expo-sqlite';

export default async function (db: SQLiteDatabase) {
  await db.execAsync(`
  CREATE TABLE "friendships" (
	"id" text PRIMARY KEY NOT NULL,
	"server_id" text NOT NULL,
	"user1_id" text NOT NULL,
	"user2_id" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" integer NOT NULL,
	"updated_at" integer NOT NULL,
	"version" integer DEFAULT 0 NOT NULL,
	"is_deleted" integer DEFAULT false NOT NULL,
	"deleted_at" integer,
	FOREIGN KEY ("server_id") REFERENCES "servers"("id") ON UPDATE no action ON DELETE no action,
	FOREIGN KEY ("user1_id") REFERENCES "users"("id_user") ON UPDATE no action ON DELETE no action,
	FOREIGN KEY ("user2_id") REFERENCES "users"("id_user") ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX "user1_user2_unq" ON "friendships" ("user1_id","user2_id");
`);
}
