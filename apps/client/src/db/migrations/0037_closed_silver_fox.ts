import type { SQLiteDatabase } from 'expo-sqlite';

export default async function (db: SQLiteDatabase) {
  await db.execAsync(`
  ALTER TABLE "world_rules" ADD "section" text DEFAULT 'rule' NOT NULL;--> statement-breakpoint
ALTER TABLE "world_rules" ADD "type" text;--> statement-breakpoint
ALTER TABLE "world_rules" ADD "category" text;--> statement-breakpoint
ALTER TABLE "world_rules" ADD "behavior" text;--> statement-breakpoint
ALTER TABLE "world_rules" ADD "usability" text;--> statement-breakpoint
ALTER TABLE "world_rules" ADD "danger" text;
`);
}
