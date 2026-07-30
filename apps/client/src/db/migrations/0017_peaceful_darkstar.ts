import { SQLiteDatabase } from 'expo-sqlite';

export default async function (db: SQLiteDatabase) {
  await db.execAsync(`
  CREATE TABLE "sync_conflicts" (
	"id" text PRIMARY KEY NOT NULL,
	"story_id" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"reason" text NOT NULL,
	"local_operation_type" text NOT NULL,
	"local_operation_ids" text NOT NULL,
	"local_values" text NOT NULL,
	"server_values" text,
	"client_version" integer,
	"server_version" integer,
	"message" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"resolution" text,
	"detected_at" integer NOT NULL,
	"resolved_at" integer
);
--> statement-breakpoint
ALTER TABLE "operation_logs" ADD "conflict_state" text;
`);
}
