ALTER TABLE "packs" ADD COLUMN "visibility" text DEFAULT 'private' NOT NULL;--> statement-breakpoint
CREATE INDEX "pack_visibility_idx" ON "packs" USING btree ("visibility");