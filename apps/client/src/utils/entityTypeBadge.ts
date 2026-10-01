import type { Ionicons } from '@expo/vector-icons';
import { getEntityAppearance, OperationLogEntityType } from '@keres/shared';

/** The entity types that are a link between two others: they share one icon instead of a picture each. */
const LINK_ENTITY_TYPES = new Set<string>([
  OperationLogEntityType.CharacterRelation,
  OperationLogEntityType.CharacterScene,
  OperationLogEntityType.GalleryRelation,
  OperationLogEntityType.LocationRelation,
  OperationLogEntityType.NoteRelation,
  OperationLogEntityType.PlotScene,
  OperationLogEntityType.SeeAlsoRelation,
  OperationLogEntityType.StatRelation,
  OperationLogEntityType.TagRelation,
]);

export function isLinkEntityType(entityType: string): boolean {
  return LINK_ENTITY_TYPES.has(entityType);
}

/**
 * The icon and color an entity type wears wherever it is listed (the operation log, the entity
 * count): its own look from the shared appearance table, and the link icon in `linkColor` for the
 * types that only join two others.
 */
export function getEntityTypeBadge(
  entityType: string,
  linkColor: string,
): { icon: keyof typeof Ionicons.glyphMap; color: string } {
  if (isLinkEntityType(entityType)) return { icon: 'link-outline', color: linkColor };
  const appearance = getEntityAppearance(entityType);
  return { icon: appearance.icon as keyof typeof Ionicons.glyphMap, color: appearance.color };
}
