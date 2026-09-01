ALTER TABLE "world_rules" ADD COLUMN "section" text DEFAULT 'rule' NOT NULL;--> statement-breakpoint
ALTER TABLE "world_rules" ADD COLUMN "type" text;--> statement-breakpoint
ALTER TABLE "world_rules" ADD COLUMN "category" text;--> statement-breakpoint
ALTER TABLE "world_rules" ADD COLUMN "behavior" text;--> statement-breakpoint
ALTER TABLE "world_rules" ADD COLUMN "usability" text;--> statement-breakpoint
ALTER TABLE "world_rules" ADD COLUMN "danger" text;