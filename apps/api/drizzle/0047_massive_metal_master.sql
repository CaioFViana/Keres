CREATE TABLE "story_invitations" (
	"id" text PRIMARY KEY NOT NULL,
	"story_id" text NOT NULL,
	"inviter_id" text NOT NULL,
	"invitee_id" text NOT NULL,
	"permission_type" "story_permission_type" NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "story_invitations_story_invitee_unq" UNIQUE("story_id","invitee_id")
);
--> statement-breakpoint
ALTER TABLE "story_invitations" ADD CONSTRAINT "story_invitations_story_id_stories_id_fk" FOREIGN KEY ("story_id") REFERENCES "public"."stories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "story_invitations" ADD CONSTRAINT "story_invitations_inviter_id_users_id_fk" FOREIGN KEY ("inviter_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "story_invitations" ADD CONSTRAINT "story_invitations_invitee_id_users_id_fk" FOREIGN KEY ("invitee_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;