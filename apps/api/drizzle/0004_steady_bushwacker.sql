CREATE TABLE "attribute_values" (
	"id" text PRIMARY KEY NOT NULL,
	"story_id" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"field_id" text NOT NULL,
	"value" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"deleted_at" timestamp,
	CONSTRAINT "entity_field_unq" UNIQUE("entity_id","field_id")
);
--> statement-breakpoint
CREATE TABLE "story_schema_fields" (
	"id" text PRIMARY KEY NOT NULL,
	"story_id" text NOT NULL,
	"entity_type" text NOT NULL,
	"name" text NOT NULL,
	"key" text NOT NULL,
	"description" text,
	"type" text NOT NULL,
	"is_required" boolean DEFAULT false NOT NULL,
	"default_value" text,
	"order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"deleted_at" timestamp,
	CONSTRAINT "story_entitytype_key_unq" UNIQUE("story_id","entity_type","key")
);
--> statement-breakpoint
ALTER TABLE "attribute_values" ADD CONSTRAINT "attribute_values_story_id_stories_id_fk" FOREIGN KEY ("story_id") REFERENCES "public"."stories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attribute_values" ADD CONSTRAINT "attribute_values_field_id_story_schema_fields_id_fk" FOREIGN KEY ("field_id") REFERENCES "public"."story_schema_fields"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "story_schema_fields" ADD CONSTRAINT "story_schema_fields_story_id_stories_id_fk" FOREIGN KEY ("story_id") REFERENCES "public"."stories"("id") ON DELETE no action ON UPDATE no action;