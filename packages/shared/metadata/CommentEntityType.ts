/**
 * Entity types that can receive per-field comments. It deliberately mirrors `GlobalSearchEntityType`
 * (`packages/shared/metadata/globalSearchFields.ts`) and `NavigableEntityType`
 * (`apps/client/src/utils/entityNavigation.ts`) - the same 10 navigable types, kept in sync by hand
 * across the three files as is already the convention in this project. Unlike `SeeAlsoEntityType`,
 * it includes Tag and Note: a comment is a generic annotation concept, and restricting it to the
 * same exclusion list as "See also" makes no sense.
 */
export const COMMENT_ENTITY_TYPES = [
  'Character',
  'Scene',
  'Location',
  'Item',
  'ItemJourney',
  'Tag',
  'Choice',
  'Chapter',
  'Note',
  'WorldRule',
] as const;

export type CommentEntityType = (typeof COMMENT_ENTITY_TYPES)[number];
