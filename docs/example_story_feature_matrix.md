# Example story feature matrix

The bundled stories are both a public-domain starter catalogue and a stable source of import/export
fixtures. Each package must contain every collection of the current full-story format, even when a
collection is empty because it does not fit the story. The matrix below decides where a feature is
shown with real data; it prevents new features from being silently absent from the catalogue.

## Shared baseline

Every example demonstrates chapters, scenes, scene timing, characters, locations, location
relations, items and journeys, world rules, notes, tags, suggestions, comments, see-also links,
favourites, custom fields, attributes, stats, modes, effects and a linked gallery item. Story
settings are written explicitly rather than relying on schema defaults.

Every package also includes all export collections, including empty ones where a feature is not
applicable. English and Portuguese copies keep the same identifiers and graph structure.

## Narrative-specific showcases

| Story | Narrative type | Features deliberately demonstrated |
| --- | --- | --- |
| Alice in Wonderland | Branching | Choice graph, AND/OR conditions, effects, and a board that connects characters, scenes, items and an editorial note. |
| Beauty and the Beast | Branching | Choice graph and a location map of the castle, with location pins and the story's containment/connection relations. |
| Cinderella | Linear | Primary custom calendar, starting date and time, chapter anchors, calendar-aware scene timing, and a `story_date` custom attribute. |
| Goldilocks and the Three Bears | Linear | The normal Gregorian timeline: explicit epoch day/time with no custom calendar, keeping normal-date behavior visible. |
| The Little Mermaid | Linear | Location map of sea and shore locations, including navigable location pins and their real relations. |
| The Tale of the Bamboo Cutter | Linear | A non-primary parallel calendar with a backward era, including years before its era boundary. |

## Media rule

Bundled examples are installed from JSON, whereas image/video/audio bytes belong to the ZIP media
path. They therefore demonstrate gallery metadata through external links and gallery relations,
but do not claim to bundle local bitmap files. The API export/import round-trip fixture owns the
separate guarantee that a location-map image and its gallery identifier survive remapping.

## Maintenance rule

When a new entity, story field, or export collection is added, update this matrix, the example
generator, and the catalogue test in the same change. A current-format bundled example must never
depend on a legacy optional collection or an implicit schema default.

## Sketches and scene pages

The bundled examples carry `storySketches` and `scenePages` as empty collections. A sketch is drawing
data and a scene page points at a sketch or at a gallery image; the bundled stories ship no bitmaps
(see the media rule) and none of them is a comic or a storyboard, so there is nothing real to show.
`cloneExampleStory` still maps both collections, and the API export/import round-trip fixture owns
the guarantee that a scene page survives remapping, with a sketch and with a gallery image, and that
a page whose image is gone keeps its text.

## Arc medium

Every example's default arc is a prose work (`medium: generic`, no vocabulary, author or cover of its
own), so a bundled story reads exactly as it always has. The other forms of a work (screenplay, comic,
storyboard, tabletop campaign) are demonstrated by the shipped packs and the help pages, not by
bundled stories.
