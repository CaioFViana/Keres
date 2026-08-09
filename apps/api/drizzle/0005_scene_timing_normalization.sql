ALTER TABLE "stories" ADD COLUMN "normalize_scene_timing" boolean DEFAULT false NOT NULL;
UPDATE "stories" SET "normalize_scene_timing" = false WHERE "normalize_scene_timing" IS NULL;
