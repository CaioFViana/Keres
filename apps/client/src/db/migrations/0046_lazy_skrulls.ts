import type { SQLiteDatabase } from 'expo-sqlite';

export default async function (db: SQLiteDatabase) {
  await db.execAsync(`
  CREATE TABLE "story_invitations" (
	"id" text PRIMARY KEY NOT NULL,
	"server_id" text NOT NULL,
	"story_id" text NOT NULL,
	"story_title" text NOT NULL,
	"inviter_id" text NOT NULL,
	"inviter_username" text NOT NULL,
	"invitee_id" text NOT NULL,
	"invitee_username" text NOT NULL,
	"permission_type" text NOT NULL,
	"created_at" integer NOT NULL,
	FOREIGN KEY ("server_id") REFERENCES "servers"("id") ON UPDATE no action ON DELETE no action
);

`);
}
