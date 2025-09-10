ALTER TABLE "chapter_tags" DROP CONSTRAINT "chapter_tags_chapter_id_chapters_id_fk";
--> statement-breakpoint
ALTER TABLE "location_tags" DROP CONSTRAINT "location_tags_location_id_locations_id_fk";
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "chapter_tags" ADD CONSTRAINT "chapter_tags_chapter_id_chapters_id_fk" FOREIGN KEY ("chapter_id") REFERENCES "chapters"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "location_tags" ADD CONSTRAINT "location_tags_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
