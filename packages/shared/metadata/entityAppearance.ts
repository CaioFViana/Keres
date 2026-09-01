/**
 * Colour and icon for each story-dictionary type, shared by the overview tiles, gallery links,
 * board pins and any other picker that groups by entity.
 *
 * Icon names are Ionicons glyphs. Kept as strings here so this package does not depend on Expo.
 */
export const ENTITY_APPEARANCE = {
  Chapter: { color: '#F44336', icon: 'bookmarks' },
  Event: { color: '#5C6BC0', icon: 'flag' },
  Scene: { color: '#a13fb3', icon: 'easel' },
  Location: { color: '#8BC34A', icon: 'map' },
  Character: { color: '#37afa5', icon: 'people' },
  Note: { color: '#FFEB3B', icon: 'document' },
  WorldRule: { color: '#03A9F4', icon: 'globe' },
  Item: { color: '#795548', icon: 'cube' },
  Gallery: { color: '#009688', icon: 'images' },
  Tag: { color: '#E91E63', icon: 'pricetag' },
  StorySchemaField: { color: '#673AB7', icon: 'options' },
  Choice: { color: '#FF9800', icon: 'shuffle' },
  /** Branching-story forks on the overview card — not a stored entity. */
  Fork: { color: '#FFD700', icon: 'git-branch' },
  Plot: { color: '#FFD700', icon: 'git-branch' },
  Board: { color: '#3D5A80', icon: 'albums' },
} as const;

export type EntityAppearanceKey = keyof typeof ENTITY_APPEARANCE;
export type EntityAppearance = { readonly color: string; readonly icon: string };

/** Visual vocabulary for World Piece sections in grouped selectors and relationship managers. */
export const WORLD_PIECE_SECTION_APPEARANCE: Record<WorldPieceSection, EntityAppearance> = {
  rule: { color: '#0288D1', icon: 'shield-checkmark-outline' },
  fauna: { color: '#7CB342', icon: 'paw-outline' },
  flora: { color: '#2E7D32', icon: 'leaf-outline' },
  mythology: { color: '#7E57C2', icon: 'sparkles-outline' },
  people: { color: '#F9A825', icon: 'people-outline' },
  knowledge: { color: '#546E7A', icon: 'library-outline' },
  other: { color: '#78909C', icon: 'ellipsis-horizontal-circle-outline' },
};

const FALLBACK: EntityAppearance = { color: '#607D8B', icon: 'ellipse' };

export function getEntityAppearance(entityType: string): EntityAppearance {
  return ENTITY_APPEARANCE[entityType as EntityAppearanceKey] ?? FALLBACK;
}
import type { WorldPieceSection } from '../entities/WorldRule';
