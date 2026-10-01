ALTER TABLE "operation_log" ADD COLUMN "client_operation_id" text;--> statement-breakpoint
-- A plain (non-CONCURRENTLY) index build, deliberately: drizzle-orm's migrator wraps the whole
-- migration run in one transaction, and CONCURRENTLY refuses to run inside a transaction block.
-- The lock only matters for very large tables; operation_log per story is small.
CREATE UNIQUE INDEX "operation_log_story_id_client_operation_id_idx" ON "operation_log" USING btree ("story_id","client_operation_id");