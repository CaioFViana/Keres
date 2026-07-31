CREATE TYPE "public"."operation_type" AS ENUM('create', 'update', 'delete', 'reorder');--> statement-breakpoint
CREATE TYPE "public"."story_permission_type" AS ENUM('reader', 'writer');--> statement-breakpoint
CREATE TYPE "public"."story_type" AS ENUM('linear', 'branching');--> statement-breakpoint
CREATE TYPE "public"."friend_status" AS ENUM('pending', 'friend', 'blacklisted');--> statement-breakpoint
CREATE TABLE "chapters" (
	"id" text PRIMARY KEY NOT NULL,
	"story_id" text NOT NULL,
	"name" text NOT NULL,
	"index" integer NOT NULL,
	"summary" text,
	"is_favorite" boolean DEFAULT false NOT NULL,
	"extra_notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "character_relations" (
	"id" text PRIMARY KEY NOT NULL,
	"story_id" text NOT NULL,
	"character1_id" text NOT NULL,
	"character2_id" text NOT NULL,
	"relation_type" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"deleted_at" timestamp,
	CONSTRAINT "story_char1_char2_unq" UNIQUE("story_id","character1_id","character2_id")
);
--> statement-breakpoint
CREATE TABLE "characters" (
	"id" text PRIMARY KEY NOT NULL,
	"story_id" text NOT NULL,
	"name" text NOT NULL,
	"title" text,
	"gender" text,
	"race" text,
	"subrace" text,
	"description" text,
	"personality" text,
	"motivation" text,
	"qualities" text,
	"weaknesses" text,
	"biography" text,
	"planned_timeline" text,
	"is_favorite" boolean DEFAULT false NOT NULL,
	"extra_notes" text,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "character_scenes" (
	"id" text PRIMARY KEY NOT NULL,
	"character_id" text NOT NULL,
	"story_id" text NOT NULL,
	"scene_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "choices" (
	"id" text PRIMARY KEY NOT NULL,
	"story_id" text NOT NULL,
	"scene_id" text NOT NULL,
	"next_scene_id" text NOT NULL,
	"text" text NOT NULL,
	"is_implicit" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "friendships" (
	"id" text PRIMARY KEY NOT NULL,
	"sender_id" text NOT NULL,
	"receiver_id" text NOT NULL,
	"status" "friend_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "sender_receiver_unq" UNIQUE("sender_id","receiver_id")
);
--> statement-breakpoint
CREATE TABLE "galleries" (
	"id" text PRIMARY KEY NOT NULL,
	"story_id" text NOT NULL,
	"media_type" text NOT NULL,
	"mime_type" text NOT NULL,
	"file_name" text NOT NULL,
	"hash" text NOT NULL,
	"size_bytes" integer DEFAULT 0 NOT NULL,
	"title" text,
	"is_favorite" boolean DEFAULT false NOT NULL,
	"extra_notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
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
CREATE TABLE "item_journeys" (
	"id" text PRIMARY KEY NOT NULL,
	"story_id" text NOT NULL,
	"item_id" text NOT NULL,
	"scene_id" text NOT NULL,
	"new_character_owner_id" text,
	"new_state" text NOT NULL,
	"extra_notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "items" (
	"id" text PRIMARY KEY NOT NULL,
	"story_id" text NOT NULL,
	"character_owner_id" text,
	"name" text NOT NULL,
	"category" text,
	"description" text,
	"initial_state" text,
	"is_favorite" boolean DEFAULT false NOT NULL,
	"extra_notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "locations" (
	"id" text PRIMARY KEY NOT NULL,
	"story_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"climate" text,
	"culture" text,
	"politics" text,
	"is_favorite" boolean DEFAULT false NOT NULL,
	"extra_notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "notes" (
	"id" text PRIMARY KEY NOT NULL,
	"story_id" text NOT NULL,
	"title" text NOT NULL,
	"body" text,
	"is_favorite" boolean DEFAULT false NOT NULL,
	"extra_notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "note_relations" (
	"id" text PRIMARY KEY NOT NULL,
	"story_id" text NOT NULL,
	"note_id" text NOT NULL,
	"relation_id" text NOT NULL,
	"relation_type" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "operation_log" (
	"id" text PRIMARY KEY NOT NULL,
	"story_id" text NOT NULL,
	"user_id" text NOT NULL,
	"operation_version" integer NOT NULL,
	"operation_type" "operation_type" NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"payload" jsonb NOT NULL,
	"entity_version" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scenes" (
	"id" text PRIMARY KEY NOT NULL,
	"story_id" text NOT NULL,
	"chapter_id" text NOT NULL,
	"location_id" text NOT NULL,
	"name" text NOT NULL,
	"index" integer NOT NULL,
	"summary" text,
	"gap" integer,
	"gap_type" text,
	"duration" integer,
	"duration_type" text,
	"is_start" boolean DEFAULT false NOT NULL,
	"is_finish" boolean DEFAULT false NOT NULL,
	"is_favorite" boolean DEFAULT false NOT NULL,
	"extra_notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "stories" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"title" text NOT NULL,
	"type" "story_type" NOT NULL,
	"description" text,
	"genre" text,
	"language" text,
	"author" text,
	"is_favorite" boolean DEFAULT false NOT NULL,
	"extra_notes" text,
	"theme" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "story_permissions" (
	"id" text PRIMARY KEY NOT NULL,
	"story_id" text NOT NULL,
	"user_id" text NOT NULL,
	"permission_type" "story_permission_type" NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "suggestions" (
	"id" text PRIMARY KEY NOT NULL,
	"story_id" text NOT NULL,
	"type" text NOT NULL,
	"value" text NOT NULL,
	"is_favorite" boolean DEFAULT false NOT NULL,
	"extra_notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"deleted_at" timestamp,
	CONSTRAINT "story_suggestion_type_value_unq" UNIQUE("story_id","type","value")
);
--> statement-breakpoint
CREATE TABLE "tag_relations" (
	"id" text PRIMARY KEY NOT NULL,
	"story_id" text NOT NULL,
	"tag_id" text NOT NULL,
	"relation_id" text NOT NULL,
	"relation_type" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"deleted_at" timestamp,
	CONSTRAINT "story_tag_relation_unq" UNIQUE("story_id","tag_id","relation_id","relation_type")
);
--> statement-breakpoint
CREATE TABLE "tags" (
	"id" text PRIMARY KEY NOT NULL,
	"story_id" text NOT NULL,
	"name" text NOT NULL,
	"color" text,
	"is_favorite" boolean DEFAULT false NOT NULL,
	"extra_notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"deleted_at" timestamp,
	CONSTRAINT "story_name_unq" UNIQUE("story_id","name")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"tag" text NOT NULL,
	"password" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"deleted_at" timestamp,
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
CREATE TABLE "world_rules" (
	"id" text PRIMARY KEY NOT NULL,
	"story_id" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"is_favorite" boolean DEFAULT false NOT NULL,
	"extra_notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "chapters" ADD CONSTRAINT "chapters_story_id_stories_id_fk" FOREIGN KEY ("story_id") REFERENCES "public"."stories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "character_relations" ADD CONSTRAINT "character_relations_story_id_stories_id_fk" FOREIGN KEY ("story_id") REFERENCES "public"."stories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "character_relations" ADD CONSTRAINT "character_relations_character1_id_characters_id_fk" FOREIGN KEY ("character1_id") REFERENCES "public"."characters"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "character_relations" ADD CONSTRAINT "character_relations_character2_id_characters_id_fk" FOREIGN KEY ("character2_id") REFERENCES "public"."characters"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "characters" ADD CONSTRAINT "characters_story_id_stories_id_fk" FOREIGN KEY ("story_id") REFERENCES "public"."stories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "character_scenes" ADD CONSTRAINT "character_scenes_character_id_characters_id_fk" FOREIGN KEY ("character_id") REFERENCES "public"."characters"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "character_scenes" ADD CONSTRAINT "character_scenes_story_id_stories_id_fk" FOREIGN KEY ("story_id") REFERENCES "public"."stories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "character_scenes" ADD CONSTRAINT "character_scenes_scene_id_scenes_id_fk" FOREIGN KEY ("scene_id") REFERENCES "public"."scenes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "choices" ADD CONSTRAINT "choices_story_id_stories_id_fk" FOREIGN KEY ("story_id") REFERENCES "public"."stories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "choices" ADD CONSTRAINT "choices_scene_id_scenes_id_fk" FOREIGN KEY ("scene_id") REFERENCES "public"."scenes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "choices" ADD CONSTRAINT "choices_next_scene_id_scenes_id_fk" FOREIGN KEY ("next_scene_id") REFERENCES "public"."scenes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "friendships" ADD CONSTRAINT "friendships_sender_id_users_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "friendships" ADD CONSTRAINT "friendships_receiver_id_users_id_fk" FOREIGN KEY ("receiver_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "galleries" ADD CONSTRAINT "galleries_story_id_stories_id_fk" FOREIGN KEY ("story_id") REFERENCES "public"."stories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gallery_relations" ADD CONSTRAINT "gallery_relations_story_id_stories_id_fk" FOREIGN KEY ("story_id") REFERENCES "public"."stories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gallery_relations" ADD CONSTRAINT "gallery_relations_gallery_id_galleries_id_fk" FOREIGN KEY ("gallery_id") REFERENCES "public"."galleries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_journeys" ADD CONSTRAINT "item_journeys_story_id_stories_id_fk" FOREIGN KEY ("story_id") REFERENCES "public"."stories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_journeys" ADD CONSTRAINT "item_journeys_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_journeys" ADD CONSTRAINT "item_journeys_scene_id_scenes_id_fk" FOREIGN KEY ("scene_id") REFERENCES "public"."scenes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_journeys" ADD CONSTRAINT "item_journeys_new_character_owner_id_characters_id_fk" FOREIGN KEY ("new_character_owner_id") REFERENCES "public"."characters"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_story_id_stories_id_fk" FOREIGN KEY ("story_id") REFERENCES "public"."stories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_character_owner_id_characters_id_fk" FOREIGN KEY ("character_owner_id") REFERENCES "public"."characters"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "locations" ADD CONSTRAINT "locations_story_id_stories_id_fk" FOREIGN KEY ("story_id") REFERENCES "public"."stories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notes" ADD CONSTRAINT "notes_story_id_stories_id_fk" FOREIGN KEY ("story_id") REFERENCES "public"."stories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "note_relations" ADD CONSTRAINT "note_relations_story_id_stories_id_fk" FOREIGN KEY ("story_id") REFERENCES "public"."stories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "note_relations" ADD CONSTRAINT "note_relations_note_id_notes_id_fk" FOREIGN KEY ("note_id") REFERENCES "public"."notes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "operation_log" ADD CONSTRAINT "operation_log_story_id_stories_id_fk" FOREIGN KEY ("story_id") REFERENCES "public"."stories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "operation_log" ADD CONSTRAINT "operation_log_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scenes" ADD CONSTRAINT "scenes_story_id_stories_id_fk" FOREIGN KEY ("story_id") REFERENCES "public"."stories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scenes" ADD CONSTRAINT "scenes_chapter_id_chapters_id_fk" FOREIGN KEY ("chapter_id") REFERENCES "public"."chapters"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scenes" ADD CONSTRAINT "scenes_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stories" ADD CONSTRAINT "stories_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "story_permissions" ADD CONSTRAINT "story_permissions_story_id_stories_id_fk" FOREIGN KEY ("story_id") REFERENCES "public"."stories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "story_permissions" ADD CONSTRAINT "story_permissions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "suggestions" ADD CONSTRAINT "suggestions_story_id_stories_id_fk" FOREIGN KEY ("story_id") REFERENCES "public"."stories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tag_relations" ADD CONSTRAINT "tag_relations_story_id_stories_id_fk" FOREIGN KEY ("story_id") REFERENCES "public"."stories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tag_relations" ADD CONSTRAINT "tag_relations_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tags" ADD CONSTRAINT "tags_story_id_stories_id_fk" FOREIGN KEY ("story_id") REFERENCES "public"."stories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "world_rules" ADD CONSTRAINT "world_rules_story_id_stories_id_fk" FOREIGN KEY ("story_id") REFERENCES "public"."stories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "galleries_story_hash_idx" ON "galleries" USING btree ("story_id","hash");--> statement-breakpoint
CREATE INDEX "gallery_relations_owner_idx" ON "gallery_relations" USING btree ("story_id","owner_type","owner_id");--> statement-breakpoint
CREATE INDEX "gallery_relations_gallery_idx" ON "gallery_relations" USING btree ("gallery_id");--> statement-breakpoint
CREATE UNIQUE INDEX "media_blobs_storage_path_idx" ON "media_blobs" USING btree ("storage_path");--> statement-breakpoint
CREATE UNIQUE INDEX "users_tag_lower_idx" ON "users" USING btree (lower("tag"));