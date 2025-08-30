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
CREATE TABLE IF NOT EXISTS "relations" (
	"id" text PRIMARY KEY NOT NULL,
	"char_id_source" text NOT NULL,
	"char_id_target" text NOT NULL,
	"scene_id" text,
	"moment_id" text,
	"summary" text,
	"is_favorite" boolean DEFAULT false NOT NULL,
	"extra_notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "character_moments" ADD CONSTRAINT "character_moments_character_id_characters_id_fk" FOREIGN KEY ("character_id") REFERENCES "characters"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "character_moments" ADD CONSTRAINT "character_moments_moment_id_moments_id_fk" FOREIGN KEY ("moment_id") REFERENCES "moments"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "character_relations" ADD CONSTRAINT "character_relations_char_id_1_characters_id_fk" FOREIGN KEY ("char_id_1") REFERENCES "characters"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "character_relations" ADD CONSTRAINT "character_relations_char_id_2_characters_id_fk" FOREIGN KEY ("char_id_2") REFERENCES "characters"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "relations" ADD CONSTRAINT "relations_char_id_source_characters_id_fk" FOREIGN KEY ("char_id_source") REFERENCES "characters"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "relations" ADD CONSTRAINT "relations_char_id_target_characters_id_fk" FOREIGN KEY ("char_id_target") REFERENCES "characters"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "relations" ADD CONSTRAINT "relations_scene_id_scenes_id_fk" FOREIGN KEY ("scene_id") REFERENCES "scenes"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "relations" ADD CONSTRAINT "relations_moment_id_moments_id_fk" FOREIGN KEY ("moment_id") REFERENCES "moments"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
