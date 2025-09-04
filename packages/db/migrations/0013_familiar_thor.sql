ALTER TABLE "characters" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "notes" DROP COLUMN IF EXISTS "extra_notes";