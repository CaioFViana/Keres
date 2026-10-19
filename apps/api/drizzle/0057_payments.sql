CREATE TABLE "payment_checkouts" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"tier_id" text NOT NULL,
	"tier_name" text NOT NULL,
	"interval" text NOT NULL,
	"amount_cents" integer NOT NULL,
	"currency" text NOT NULL,
	"method_id" text NOT NULL,
	"status" text NOT NULL,
	"provider_id" text NOT NULL,
	"provider_reference" text,
	"action" jsonb,
	"failure_reason" text,
	"expires_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment_events" (
	"id" text PRIMARY KEY NOT NULL,
	"provider_id" text NOT NULL,
	"provider_event_id" text,
	"kind" text NOT NULL,
	"user_id" text,
	"tier_name" text,
	"amount_cents" integer,
	"currency" text,
	"provider_reference" text,
	"detail" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment_subscriptions" (
	"user_id" text PRIMARY KEY NOT NULL,
	"tier_id" text NOT NULL,
	"interval" text NOT NULL,
	"status" text NOT NULL,
	"paid_until" timestamp NOT NULL,
	"last_payment_at" timestamp,
	"amount_cents" integer NOT NULL,
	"currency" text NOT NULL,
	"cancel_at_period_end" boolean DEFAULT false NOT NULL,
	"provider_id" text NOT NULL,
	"provider_reference" text,
	"due_notified_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "payment_checkouts_user_idx" ON "payment_checkouts" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "payment_checkouts_reference_idx" ON "payment_checkouts" USING btree ("provider_id","provider_reference");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_events_provider_event_unique" ON "payment_events" USING btree ("provider_id","provider_event_id");--> statement-breakpoint
CREATE INDEX "payment_events_created_idx" ON "payment_events" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "payment_events_user_idx" ON "payment_events" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "payment_subscriptions_status_idx" ON "payment_subscriptions" USING btree ("status","paid_until");--> statement-breakpoint
CREATE INDEX "payment_subscriptions_reference_idx" ON "payment_subscriptions" USING btree ("provider_id","provider_reference");