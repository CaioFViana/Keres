import type { SQLiteDatabase } from 'expo-sqlite';

export default async function (db: SQLiteDatabase) {
  await db.execAsync(`
  CREATE TABLE "story_publications" (
	"id" text PRIMARY KEY NOT NULL,
	"server_id" text NOT NULL,
	"story_id" text NOT NULL,
	"label" text NOT NULL,
	"operation_version" integer NOT NULL,
	"byte_size" integer NOT NULL,
	"created_at" integer NOT NULL,
	"notified" integer DEFAULT false NOT NULL,
	FOREIGN KEY ("server_id") REFERENCES "servers"("id") ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX "publication_server_unq" ON "story_publications" ("server_id","id");
`);
}
