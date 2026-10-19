CREATE TYPE "public"."message_channel" AS ENUM('site', 'admin', 'direct');--> statement-breakpoint
CREATE TABLE "messages" (
	"id" text PRIMARY KEY NOT NULL,
	"channel" "message_channel" NOT NULL,
	"sender_id" text,
	"recipient_id" text,
	"sent_by_admin_id" text,
	"subject" text,
	"body" text NOT NULL,
	"contact_email" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"sender_deleted_at" timestamp,
	"recipient_deleted_at" timestamp,
	"admin_read_at" timestamp,
	"admin_archived_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "message_log" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"kind" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tiers" ADD COLUMN "max_messages_per_day" integer;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_sender_id_users_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_recipient_id_users_id_fk" FOREIGN KEY ("recipient_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_sent_by_admin_id_users_id_fk" FOREIGN KEY ("sent_by_admin_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "messages_recipient_idx" ON "messages" USING btree ("recipient_id","created_at");--> statement-breakpoint
CREATE INDEX "messages_sender_idx" ON "messages" USING btree ("sender_id","created_at");--> statement-breakpoint
CREATE INDEX "messages_channel_idx" ON "messages" USING btree ("channel","created_at");--> statement-breakpoint
CREATE INDEX "message_log_user_idx" ON "message_log" USING btree ("user_id","kind","created_at");--> statement-breakpoint
CREATE INDEX "message_log_created_idx" ON "message_log" USING btree ("created_at");