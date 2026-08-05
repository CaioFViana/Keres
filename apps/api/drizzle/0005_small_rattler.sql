CREATE TABLE "location_relations" (
	"id" text PRIMARY KEY NOT NULL,
	"story_id" text NOT NULL,
	"location_a_id" text NOT NULL,
	"location_b_id" text NOT NULL,
	"relation_type" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"deleted_at" timestamp,
	CONSTRAINT "story_loca_locb_type_unq" UNIQUE("story_id","location_a_id","location_b_id","relation_type")
);
--> statement-breakpoint
ALTER TABLE "location_relations" ADD CONSTRAINT "location_relations_story_id_stories_id_fk" FOREIGN KEY ("story_id") REFERENCES "public"."stories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "location_relations" ADD CONSTRAINT "location_relations_location_a_id_locations_id_fk" FOREIGN KEY ("location_a_id") REFERENCES "public"."locations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "location_relations" ADD CONSTRAINT "location_relations_location_b_id_locations_id_fk" FOREIGN KEY ("location_b_id") REFERENCES "public"."locations"("id") ON DELETE no action ON UPDATE no action;