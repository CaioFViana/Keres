CREATE TABLE IF NOT EXISTS "chapter_tags" (
	"chapter_id" text NOT NULL,
	"tag_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "chapter_tags_chapter_id_tag_id_pk" PRIMARY KEY("chapter_id","tag_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "chapters" (
	"id" text PRIMARY KEY NOT NULL,
	"story_id" text NOT NULL,
	"name" text NOT NULL,
	"index" integer NOT NULL,
	"summary" text,
	"is_favorite" boolean DEFAULT false NOT NULL,
	"extra_notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "character_moments" (
	"character_id" text NOT NULL,
	"moment_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "character_moments_character_id_moment_id_pk" PRIMARY KEY("character_id","moment_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "character_relations" (
	"id" text PRIMARY KEY NOT NULL,
	"char_id_1" text NOT NULL,
	"char_id_2" text NOT NULL,
	"relation_type" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "character_tags" (
	"character_id" text NOT NULL,
	"tag_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "character_tags_character_id_tag_id_pk" PRIMARY KEY("character_id","tag_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "characters" (
	"id" text PRIMARY KEY NOT NULL,
	"story_id" text NOT NULL,
	"name" text NOT NULL,
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
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "choices" (
	"id" text PRIMARY KEY NOT NULL,
	"scene_id" text NOT NULL,
	"next_scene_id" text NOT NULL,
	"text" text NOT NULL,
	"is_implicit" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "gallery" (
	"id" text PRIMARY KEY NOT NULL,
	"story_id" text NOT NULL,
	"owner_id" text NOT NULL,
	"owner_type" text NOT NULL,
	"image_path" text NOT NULL,
	"is_file" boolean DEFAULT false NOT NULL,
	"is_favorite" boolean DEFAULT false NOT NULL,
	"extra_notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "location_tags" (
	"location_id" text NOT NULL,
	"tag_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "location_tags_location_id_tag_id_pk" PRIMARY KEY("location_id","tag_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "locations" (
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
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "moments" (
	"id" text PRIMARY KEY NOT NULL,
	"scene_id" text NOT NULL,
	"name" text NOT NULL,
	"location" text,
	"index" integer NOT NULL,
	"summary" text,
	"is_favorite" boolean DEFAULT false NOT NULL,
	"extra_notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "notes" (
	"id" text PRIMARY KEY NOT NULL,
	"story_id" text NOT NULL,
	"title" text NOT NULL,
	"body" text,
	"gallery_id" text,
	"is_favorite" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "scene_tags" (
	"scene_id" text NOT NULL,
	"tag_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "scene_tags_scene_id_tag_id_pk" PRIMARY KEY("scene_id","tag_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "scenes" (
	"id" text PRIMARY KEY NOT NULL,
	"chapter_id" text NOT NULL,
	"location_id" text NOT NULL,
	"name" text NOT NULL,
	"index" integer NOT NULL,
	"summary" text,
	"gap" text,
	"duration" text,
	"is_favorite" boolean DEFAULT false NOT NULL,
	"extra_notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "story" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"type" text DEFAULT 'linear' NOT NULL,
	"title" text NOT NULL,
	"summary" text,
	"genre" text,
	"language" text,
	"is_favorite" boolean DEFAULT false NOT NULL,
	"extra_notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "suggestions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"scope" text NOT NULL,
	"story_id" text,
	"type" text NOT NULL,
	"value" text NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tags" (
	"id" text PRIMARY KEY NOT NULL,
	"story_id" text NOT NULL,
	"name" text NOT NULL,
	"color" text,
	"is_favorite" boolean DEFAULT false NOT NULL,
	"extra_notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "users" (
	"id" text PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"password_hash" text NOT NULL,
	"password_salt" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "world_rules" (
	"id" text PRIMARY KEY NOT NULL,
	"story_id" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"is_favorite" boolean DEFAULT false NOT NULL,
	"extra_notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "chapter_tags" ADD CONSTRAINT "chapter_tags_chapter_id_chapters_id_fk" FOREIGN KEY ("chapter_id") REFERENCES "chapters"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "chapter_tags" ADD CONSTRAINT "chapter_tags_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "tags"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "chapters" ADD CONSTRAINT "chapters_story_id_story_id_fk" FOREIGN KEY ("story_id") REFERENCES "story"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "character_moments" ADD CONSTRAINT "character_moments_character_id_characters_id_fk" FOREIGN KEY ("character_id") REFERENCES "characters"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "character_moments" ADD CONSTRAINT "character_moments_moment_id_moments_id_fk" FOREIGN KEY ("moment_id") REFERENCES "moments"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "character_relations" ADD CONSTRAINT "character_relations_char_id_1_characters_id_fk" FOREIGN KEY ("char_id_1") REFERENCES "characters"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "character_relations" ADD CONSTRAINT "character_relations_char_id_2_characters_id_fk" FOREIGN KEY ("char_id_2") REFERENCES "characters"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "character_tags" ADD CONSTRAINT "character_tags_character_id_characters_id_fk" FOREIGN KEY ("character_id") REFERENCES "characters"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "character_tags" ADD CONSTRAINT "character_tags_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "tags"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "characters" ADD CONSTRAINT "characters_story_id_story_id_fk" FOREIGN KEY ("story_id") REFERENCES "story"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "choices" ADD CONSTRAINT "choices_scene_id_scenes_id_fk" FOREIGN KEY ("scene_id") REFERENCES "scenes"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "choices" ADD CONSTRAINT "choices_next_scene_id_scenes_id_fk" FOREIGN KEY ("next_scene_id") REFERENCES "scenes"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "gallery" ADD CONSTRAINT "gallery_story_id_story_id_fk" FOREIGN KEY ("story_id") REFERENCES "story"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "location_tags" ADD CONSTRAINT "location_tags_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "location_tags" ADD CONSTRAINT "location_tags_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "tags"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "locations" ADD CONSTRAINT "locations_story_id_story_id_fk" FOREIGN KEY ("story_id") REFERENCES "story"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "moments" ADD CONSTRAINT "moments_scene_id_scenes_id_fk" FOREIGN KEY ("scene_id") REFERENCES "scenes"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "notes" ADD CONSTRAINT "notes_story_id_story_id_fk" FOREIGN KEY ("story_id") REFERENCES "story"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "notes" ADD CONSTRAINT "notes_gallery_id_gallery_id_fk" FOREIGN KEY ("gallery_id") REFERENCES "gallery"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "scene_tags" ADD CONSTRAINT "scene_tags_scene_id_scenes_id_fk" FOREIGN KEY ("scene_id") REFERENCES "scenes"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "scene_tags" ADD CONSTRAINT "scene_tags_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "tags"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "scenes" ADD CONSTRAINT "scenes_chapter_id_chapters_id_fk" FOREIGN KEY ("chapter_id") REFERENCES "chapters"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "scenes" ADD CONSTRAINT "scenes_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "story" ADD CONSTRAINT "story_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "suggestions" ADD CONSTRAINT "suggestions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "suggestions" ADD CONSTRAINT "suggestions_story_id_story_id_fk" FOREIGN KEY ("story_id") REFERENCES "story"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "tags" ADD CONSTRAINT "tags_story_id_story_id_fk" FOREIGN KEY ("story_id") REFERENCES "story"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "world_rules" ADD CONSTRAINT "world_rules_story_id_story_id_fk" FOREIGN KEY ("story_id") REFERENCES "story"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
