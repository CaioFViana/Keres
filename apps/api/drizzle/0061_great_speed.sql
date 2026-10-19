CREATE TABLE "play_purchase_claims" (
	"purchase_token_hash" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"product_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "play_purchase_claims_user_idx" ON "play_purchase_claims" USING btree ("user_id","created_at");