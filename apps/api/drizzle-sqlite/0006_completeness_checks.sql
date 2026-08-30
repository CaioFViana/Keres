-- Story Analysis stops reporting elements that merely exist without being referenced.
--
-- Off for every existing story: a location in no scene is not a defect in a story bible, it is a
-- place that exists in the world. Broken references and numbering are reported either way - those
-- are integrity, not opinion.
ALTER TABLE `stories` ADD `completeness_checks` integer DEFAULT false NOT NULL;
