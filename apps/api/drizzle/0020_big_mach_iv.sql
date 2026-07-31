ALTER TABLE "users" ADD COLUMN "tag" text;--> statement-breakpoint
-- Backfill: usernames are already globally unique, so seeding tag = username guarantees
-- every existing user starts with a valid, unique tag with zero manual intervention.
UPDATE "users" SET "tag" = "username" WHERE "tag" IS NULL;--> statement-breakpoint
-- Case-insensitive dedupe safety net: if two existing usernames differ only by case
-- (e.g. "Caio" / "caio"), their backfilled tags would collide under the case-insensitive
-- unique index below. Disambiguate any such collision by suffixing a row number.
WITH "ranked" AS (
  SELECT "id", ROW_NUMBER() OVER (PARTITION BY lower("tag") ORDER BY "created_at") AS "rn"
  FROM "users"
)
UPDATE "users" "u"
SET "tag" = "u"."tag" || "ranked"."rn"::text
FROM "ranked"
WHERE "u"."id" = "ranked"."id" AND "ranked"."rn" > 1;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "tag" SET NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "users_tag_lower_idx" ON "users" USING btree (lower("tag"));
