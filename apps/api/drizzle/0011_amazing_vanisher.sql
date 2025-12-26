ALTER TABLE "friendships" RENAME COLUMN "user1_id" TO "sender_id";--> statement-breakpoint
ALTER TABLE "friendships" RENAME COLUMN "user2_id" TO "receiver_id";--> statement-breakpoint
ALTER TABLE "friendships" DROP CONSTRAINT "user1_user2_unq";--> statement-breakpoint
ALTER TABLE "friendships" DROP CONSTRAINT "friendships_user1_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "friendships" DROP CONSTRAINT "friendships_user2_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "friendships" ADD COLUMN "server_id" text NOT NULL;--> statement-breakpoint
ALTER TABLE "friendships" ADD CONSTRAINT "friendships_sender_id_users_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "friendships" ADD CONSTRAINT "friendships_receiver_id_users_id_fk" FOREIGN KEY ("receiver_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "friendships" ADD CONSTRAINT "sender_receiver_unq" UNIQUE("sender_id","receiver_id");