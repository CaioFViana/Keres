CREATE TABLE "plots" (
  "id" text PRIMARY KEY NOT NULL,
  "story_id" text NOT NULL REFERENCES "stories"("id"),
  "name" text NOT NULL,
  "details" text,
  "created_at" integer NOT NULL,
  "updated_at" integer NOT NULL,
  "version" integer DEFAULT 1 NOT NULL,
  "is_deleted" integer DEFAULT false NOT NULL,
  "deleted_at" integer
);
--> statement-breakpoint
CREATE TABLE "plot_scenes" (
  "id" text PRIMARY KEY NOT NULL,
  "story_id" text NOT NULL REFERENCES "stories"("id"),
  "plot_id" text NOT NULL REFERENCES "plots"("id"),
  "scene_id" text NOT NULL REFERENCES "scenes"("id"),
  "note" text NOT NULL,
  "created_at" integer NOT NULL,
  "updated_at" integer NOT NULL,
  "version" integer DEFAULT 1 NOT NULL,
  "is_deleted" integer DEFAULT false NOT NULL,
  "deleted_at" integer
);
--> statement-breakpoint
CREATE INDEX "plot_scene_story_idx" ON "plot_scenes" ("story_id");
--> statement-breakpoint
CREATE INDEX "plot_scene_plot_idx" ON "plot_scenes" ("plot_id");
--> statement-breakpoint
CREATE INDEX "plot_scene_scene_idx" ON "plot_scenes" ("scene_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "plot_scene_pair_unique" ON "plot_scenes" ("plot_id", "scene_id") WHERE "is_deleted" = false;
