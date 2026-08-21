ALTER TABLE "stories" ADD COLUMN "last_operation_version" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
-- Backfill obrigatório antes do índice único abaixo: sem isto, a próxima operação de uma
-- história que já tem histórico calcularia last_operation_version + 1 = 1, colidindo com o
-- operation_version = 1 que já existe para ela.
UPDATE "stories" s SET "last_operation_version" = COALESCE(
  (SELECT MAX(ol.operation_version) FROM "operation_log" ol WHERE ol.story_id = s.id),
  0
);--> statement-breakpoint
CREATE UNIQUE INDEX "operation_log_story_id_operation_version_idx" ON "operation_log" USING btree ("story_id","operation_version");