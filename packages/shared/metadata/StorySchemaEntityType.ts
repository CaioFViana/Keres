/**
 * Entity types that can receive custom attributes via Story Schemas - the entities with dedicated
 * Form + Detail screens, excluding relation/junction tables (CharacterRelation, TagRelation,
 * NoteRelation, CharacterScene, GalleryRelation, LocationRelation), Choice/Gallery (structurally
 * different forms) and Story itself.
 *
 * An array of constants rather than an enum so that adding a new type later is trivial (one line),
 * without having to touch anywhere else that depends on the enum's shape. The list also defines the
 * possible targets of Entity-typed attributes; every type added here needs a route in
 * `ENTITY_ROUTES` in the client.
 */
export const STORY_SCHEMA_ENTITY_TYPES = [
  'Character',
  'Location',
  'Item',
  'Scene',
  'Chapter',
  'Note',
  'WorldRule',
] as const;

export type StorySchemaEntityType = (typeof STORY_SCHEMA_ENTITY_TYPES)[number];
