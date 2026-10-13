CREATE TABLE "evidence_holds" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL,
	"target_kind" text NOT NULL,
	"target_id" text NOT NULL,
	"subject_user_id" text,
	"report_message_ids" jsonb NOT NULL,
	"created_by" text,
	"note" text,
	"snapshot" jsonb NOT NULL
);
--> statement-breakpoint
CREATE INDEX "evidence_holds_target_idx" ON "evidence_holds" USING btree ("target_kind","target_id");--> statement-breakpoint
CREATE INDEX "evidence_holds_expires_idx" ON "evidence_holds" USING btree ("expires_at");