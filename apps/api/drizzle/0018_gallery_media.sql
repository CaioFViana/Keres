CREATE TABLE "gallery_relations" (
	"id" text PRIMARY KEY NOT NULL,
	"story_id" text NOT NULL,
	"gallery_id" text NOT NULL,
	"owner_id" text NOT NULL,
	"owner_type" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "media_blobs" (
	"hash" text PRIMARY KEY NOT NULL,
	"mime_type" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"storage_path" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "galleries" ADD COLUMN "media_type" text NOT NULL;--> statement-breakpoint
ALTER TABLE "galleries" ADD COLUMN "mime_type" text NOT NULL;--> statement-breakpoint
ALTER TABLE "galleries" ADD COLUMN "file_name" text NOT NULL;--> statement-breakpoint
ALTER TABLE "galleries" ADD COLUMN "hash" text NOT NULL;--> statement-breakpoint
ALTER TABLE "galleries" ADD COLUMN "size_bytes" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "galleries" ADD COLUMN "title" text;--> statement-breakpoint
ALTER TABLE "gallery_relations" ADD CONSTRAINT "gallery_relations_story_id_stories_id_fk" FOREIGN KEY ("story_id") REFERENCES "public"."stories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gallery_relations" ADD CONSTRAINT "gallery_relations_gallery_id_galleries_id_fk" FOREIGN KEY ("gallery_id") REFERENCES "public"."galleries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "gallery_relations_owner_idx" ON "gallery_relations" USING btree ("story_id","owner_type","owner_id");--> statement-breakpoint
CREATE INDEX "gallery_relations_gallery_idx" ON "gallery_relations" USING btree ("gallery_id");--> statement-breakpoint
CREATE UNIQUE INDEX "media_blobs_storage_path_idx" ON "media_blobs" USING btree ("storage_path");--> statement-breakpoint
CREATE INDEX "galleries_story_hash_idx" ON "galleries" USING btree ("story_id","hash");