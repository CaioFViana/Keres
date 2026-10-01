ALTER TABLE "showcase_settings" ADD COLUMN "site_name" text DEFAULT 'Keres' NOT NULL;--> statement-breakpoint
ALTER TABLE "showcase_settings" ADD COLUMN "site_palette" text DEFAULT 'default' NOT NULL;--> statement-breakpoint
ALTER TABLE "showcase_settings" ADD COLUMN "logo_content_type" text;--> statement-breakpoint
ALTER TABLE "showcase_settings" ADD COLUMN "logo_updated_at" timestamp;