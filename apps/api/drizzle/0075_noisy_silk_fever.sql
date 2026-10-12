CREATE TABLE "age_verification_events" (
	"verifier_id" text NOT NULL,
	"event_id" text NOT NULL,
	"received_at" timestamp DEFAULT now() NOT NULL,
	"outcome" text NOT NULL,
	CONSTRAINT "age_verification_events_verifier_id_event_id_pk" PRIMARY KEY("verifier_id","event_id")
);
--> statement-breakpoint
CREATE TABLE "age_verifications" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"verifier_id" text NOT NULL,
	"provider_reference" text NOT NULL,
	"status" text NOT NULL,
	"attempt" integer NOT NULL,
	"retry_of" text,
	"method" text,
	"identity_commitment" text,
	"rejection_reason" text,
	"action_json" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp,
	"decided_at" timestamp,
	"discarded_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "verification_status" text DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "verified_at" timestamp;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "verification_method" text;--> statement-breakpoint
ALTER TABLE "age_verifications" ADD CONSTRAINT "age_verifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "age_verifications_user_idx" ON "age_verifications" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "age_verifications_commitment_unique" ON "age_verifications" USING btree ("identity_commitment");