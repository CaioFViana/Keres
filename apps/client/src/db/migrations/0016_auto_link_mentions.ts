import type { SQLiteDatabase } from 'expo-sqlite';

export default async function (db: SQLiteDatabase) {
  await db.execAsync(`
  -- Renders entity names found in a story's own text as links to those entities.
--
-- Off for every existing story on purpose: turning it on would change how everybody's text reads
-- the moment they update, with nothing having been edited. It is a reading preference, so a writer
-- may change it - it is not in STORY_OWNER_ONLY_FIELDS.
ALTER TABLE stories ADD COLUMN auto_link_mentions integer NOT NULL DEFAULT 0;

`);
}
