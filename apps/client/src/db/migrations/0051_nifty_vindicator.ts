import type { SQLiteDatabase } from 'expo-sqlite';

export default async function (db: SQLiteDatabase) {
  await db.execAsync(`
  ALTER TABLE "stories" ADD "cover_gallery_id" text;--> statement-breakpoint
ALTER TABLE "story_arcs" ADD "medium" text DEFAULT 'generic' NOT NULL;--> statement-breakpoint
ALTER TABLE "story_arcs" ADD "vocabulary" text;--> statement-breakpoint
ALTER TABLE "story_arcs" ADD "author" text;--> statement-breakpoint
ALTER TABLE "story_arcs" ADD "cover_gallery_id" text;
`);
}
