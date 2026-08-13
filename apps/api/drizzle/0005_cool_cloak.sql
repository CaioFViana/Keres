CREATE TABLE "choice_check_groups" (
	"id" text PRIMARY KEY NOT NULL,
	"story_id" text NOT NULL,
	"choice_id" text NOT NULL,
	"combinator" text DEFAULT 'AND' NOT NULL,
	"order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "choice_checks" (
	"id" text PRIMARY KEY NOT NULL,
	"story_id" text NOT NULL,
	"group_id" text NOT NULL,
	"mode" text DEFAULT 'block' NOT NULL,
	"type" text NOT NULL,
	"order" integer DEFAULT 0 NOT NULL,
	"scene_id" text,
	"min_visits" integer,
	"item_id" text,
	"item_presence" text,
	"trigger_name" text,
	"trigger_state" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "effects" (
	"id" text PRIMARY KEY NOT NULL,
	"story_id" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"effect_type" text NOT NULL,
	"item_id" text,
	"trigger_name" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "choices" ADD COLUMN "notes" text;--> statement-breakpoint
ALTER TABLE "choice_check_groups" ADD CONSTRAINT "choice_check_groups_story_id_stories_id_fk" FOREIGN KEY ("story_id") REFERENCES "public"."stories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "choice_check_groups" ADD CONSTRAINT "choice_check_groups_choice_id_choices_id_fk" FOREIGN KEY ("choice_id") REFERENCES "public"."choices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "choice_checks" ADD CONSTRAINT "choice_checks_story_id_stories_id_fk" FOREIGN KEY ("story_id") REFERENCES "public"."stories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "choice_checks" ADD CONSTRAINT "choice_checks_group_id_choice_check_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."choice_check_groups"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "choice_checks" ADD CONSTRAINT "choice_checks_scene_id_scenes_id_fk" FOREIGN KEY ("scene_id") REFERENCES "public"."scenes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "choice_checks" ADD CONSTRAINT "choice_checks_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "effects" ADD CONSTRAINT "effects_story_id_stories_id_fk" FOREIGN KEY ("story_id") REFERENCES "public"."stories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "effects" ADD CONSTRAINT "effects_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE no action ON UPDATE no action;