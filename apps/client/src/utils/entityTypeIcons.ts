import type { Ionicons } from '@expo/vector-icons';
import type { GlobalSearchEntityType } from '@keres/shared/metadata/globalSearchFields';

/**
 * An icon per entity type, used anywhere that needs to show "icon + name" for a generic entity (global
 * search, "See also", the comment list). Extracted from what was a private map inside
 * `GlobalSearchResultItem` so the other screens would not duplicate the same 10 pairs. Indexed by the
 * broadest type (`GlobalSearchEntityType`, 10 types) - subsets like `SeeAlsoEntityType` (8 types) or
 * `CommentEntityType` (10 types) index into it with no cast.
 */
export const ENTITY_TYPE_ICONS: Record<GlobalSearchEntityType, keyof typeof Ionicons.glyphMap> = {
  Character: 'person-outline',
  Scene: 'film-outline',
  Location: 'location-outline',
  Item: 'cube-outline',
  ItemJourney: 'swap-horizontal-outline',
  Tag: 'pricetag-outline',
  Choice: 'git-branch-outline',
  Chapter: 'book-outline',
  Note: 'document-text-outline',
  WorldRule: 'shield-checkmark-outline',
  Mode: 'sparkles-outline',
  Plot: 'git-network-outline',
  Route: 'trail-sign-outline',
};
