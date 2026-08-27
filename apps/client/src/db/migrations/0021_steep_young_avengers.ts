import type { SQLiteDatabase } from 'expo-sqlite';

export default async function (db: SQLiteDatabase) {
  await db.execAsync(`
  CREATE TABLE "chapter_relations" (
	"id" text PRIMARY KEY NOT NULL,
	"story_id" text NOT NULL,
	"chapter1_id" text NOT NULL,
	"chapter2_id" text NOT NULL,
	"relation_type" text NOT NULL,
	"created_at" integer NOT NULL,
	"updated_at" integer NOT NULL,
	"version" integer NOT NULL,
	"is_deleted" integer DEFAULT false NOT NULL,
	"deleted_at" integer
);
--> statement-breakpoint
-- Hand-written, and it has to be: drizzle-kit cannot emit an index over an expression - it splits
-- MIN(a, b) on the comma and produces four broken column names. The same statement was written by
-- hand in 0015 for the other relation tables, for the same reason.
--
-- The pair is *unordered* (min/max of the two ids): one live statement between two containers means
-- one, whichever column each id sits in. That is what makes "A before B" and "B before A"
-- unstorable together, so a direct contradiction cannot exist. Partial on is_deleted, because a
-- soft-deleted row must not keep the pair reserved.
CREATE UNIQUE INDEX IF NOT EXISTS "chapter_relation_pair_unique"
ON "chapter_relations" (
  "story_id",
  MIN("chapter1_id", "chapter2_id"),
  MAX("chapter1_id", "chapter2_id")
) WHERE "is_deleted" = 0;
`);
}
