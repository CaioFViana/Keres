CREATE TABLE "registration_settings" (
	"id" text PRIMARY KEY NOT NULL,
	"is_registration_open" boolean DEFAULT true NOT NULL,
	"max_users" integer,
	"auto_manage" boolean DEFAULT false NOT NULL,
	"default_tier_id" text,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tiers" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"max_stories" integer,
	"max_entities_per_story" integer,
	"max_entities_total" integer,
	"max_storage_bytes_per_story" integer,
	"max_storage_bytes_total" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"deleted_at" timestamp,
	CONSTRAINT "tiers_name_unique" UNIQUE("name")
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "is_admin" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "tier_id" text;--> statement-breakpoint
ALTER TABLE "registration_settings" ADD CONSTRAINT "registration_settings_default_tier_id_tiers_id_fk" FOREIGN KEY ("default_tier_id") REFERENCES "public"."tiers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_tier_id_tiers_id_fk" FOREIGN KEY ("tier_id") REFERENCES "public"."tiers"("id") ON DELETE no action ON UPDATE no action;