import { SQLiteDatabase } from 'expo-sqlite';

export default async function (db: SQLiteDatabase) {
  await db.execAsync(`
  CREATE TABLE "attribute_values" (
	"id" text PRIMARY KEY NOT NULL,
	"story_id" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"field_id" text NOT NULL,
	"value" text,
	"created_at" integer NOT NULL,
	"updated_at" integer NOT NULL,
	"version" integer NOT NULL,
	"is_deleted" integer DEFAULT false NOT NULL,
	"deleted_at" integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX "entity_field_unq" ON "attribute_values" ("entity_id","field_id");--> statement-breakpoint
CREATE TABLE "story_schema_fields" (
	"id" text PRIMARY KEY NOT NULL,
	"story_id" text NOT NULL,
	"entity_type" text NOT NULL,
	"name" text NOT NULL,
	"key" text NOT NULL,
	"description" text,
	"type" text NOT NULL,
	"is_required" integer DEFAULT false NOT NULL,
	"default_value" text,
	"order" integer DEFAULT 0 NOT NULL,
	"created_at" integer NOT NULL,
	"updated_at" integer NOT NULL,
	"version" integer NOT NULL,
	"is_deleted" integer DEFAULT false NOT NULL,
	"deleted_at" integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX "story_entitytype_key_unq" ON "story_schema_fields" ("story_id","entity_type","key");
`);
}
