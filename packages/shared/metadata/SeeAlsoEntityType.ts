/**
 * Entity types that can be marked as "See also" of one another - the system's navigable entities
 * except Tag/Note (which already have their own flexible relation systems via
 * TagRelation/NoteRelation) and Gallery (which is not navigable).
 */
export const SEE_ALSO_ENTITY_TYPES = [
  'Character',
  'Location',
  'Chapter',
  'Scene',
  'Item',
  'ItemJourney',
  'WorldRule',
  'Choice',
] as const;

export type SeeAlsoEntityType = (typeof SEE_ALSO_ENTITY_TYPES)[number];
