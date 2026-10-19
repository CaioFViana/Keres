CREATE TABLE "contact_messages" (
	"id" text PRIMARY KEY NOT NULL,
	"subject" text NOT NULL,
	"body" text NOT NULL,
	"contact_email" text NOT NULL,
	"is_read" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "registration_settings" ADD COLUMN "currency" text DEFAULT 'BRL' NOT NULL;--> statement-breakpoint
ALTER TABLE "showcase_settings" ADD COLUMN "is_landing_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "tiers" ADD COLUMN "price_monthly_cents" integer;--> statement-breakpoint
ALTER TABLE "tiers" ADD COLUMN "price_yearly_cents" integer;--> statement-breakpoint
ALTER TABLE "tiers" ADD COLUMN "is_public_for_sale" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "tiers" ADD COLUMN "sort_order" integer DEFAULT 0 NOT NULL;