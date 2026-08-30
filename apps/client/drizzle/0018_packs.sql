-- Packs: the reusable part of a story's structure, applied to a new story at creation.
--
-- Outside the synchronization engine, like friendships and story publications: no operation log, no
-- tombstone, no OCC. Sharing is ordinary REST against the server's own table - a pack is one row.
CREATE TABLE packs (
  id text PRIMARY KEY NOT NULL,
  name text NOT NULL,
  description text,
  language text,
  author_name text,
  version integer NOT NULL DEFAULT 1,
  content text NOT NULL,
  source_story_id text,
  created_at integer NOT NULL,
  updated_at integer NOT NULL
);
