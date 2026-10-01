ALTER TABLE "operation_log" ALTER COLUMN "operation_type" SET DATA TYPE text;--> statement-breakpoint
-- The protocol has no container order: history rows of one (a development database's) go with it.
DELETE FROM "operation_log" WHERE "operation_type" = 'reorder';--> statement-breakpoint
DROP TYPE "public"."operation_type";--> statement-breakpoint
CREATE TYPE "public"."operation_type" AS ENUM('create', 'update', 'delete');--> statement-breakpoint
ALTER TABLE "operation_log" ALTER COLUMN "operation_type" SET DATA TYPE "public"."operation_type" USING "operation_type"::"public"."operation_type";