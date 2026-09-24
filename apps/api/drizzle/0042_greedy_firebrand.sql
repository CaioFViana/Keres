ALTER TABLE "media_blobs" ADD COLUMN "unreferenced_since" timestamp;--> statement-breakpoint
CREATE INDEX "media_blobs_unreferenced_since_idx" ON "media_blobs" USING btree ("unreferenced_since");