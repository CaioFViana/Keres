import { getEntityAppearance } from '@keres/shared';
import type { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useMemo } from 'react';
import CollapsibleCard from '@/src/components/common/display/CollapsibleCard/CollapsibleCard';
import EntityRelationList from '@/src/components/common/display/EntityRelationList/EntityRelationList';
import { useNavigateToEntityDetail } from '../../../../hooks/useNavigateToEntityDetail';
import { toNavigableEntityType } from '../../../../utils/entityNavigation';

export interface RelatedEntityItem {
  id: string;
  name: string;
}

interface RelatedEntitiesListProps {
  title: string;
  noItemsMessage: string;
  /** Entity type (lowercase, e.g. "character") -> every match, with the id used to navigate. */
  groupedEntities: Record<string, RelatedEntityItem[]>;
}

const APPEARANCE_ALIASES: Record<string, string> = {
  user: 'User',
  story: 'Story',
  suggestion: 'Suggestion',
  operationlog: 'OperationLog',
};

function appearanceType(entityType: string): string {
  return (
    toNavigableEntityType(entityType) ?? APPEARANCE_ALIASES[entityType.toLowerCase()] ?? entityType
  );
}

/**
 * Read-only "what else references this" section for Note/Tag detail screens. Same compact
 * relation rows as SeeAlso / GenericRelationDisplay, with a type icon and a chevron when
 * the entity has a detail screen.
 */
const RelatedEntitiesList: React.FC<RelatedEntitiesListProps> = ({
  title,
  noItemsMessage,
  groupedEntities,
}) => {
  const navigateToDetail = useNavigateToEntityDetail();

  const handlePress = useCallback(
    (entityType: string, entityId: string) => {
      const navigableType = toNavigableEntityType(entityType);
      if (navigableType) navigateToDetail(navigableType, entityId);
    },
    [navigateToDetail],
  );

  const items = useMemo(
    () =>
      Object.entries(groupedEntities).flatMap(([entityType, group]) => {
        const navigableType = toNavigableEntityType(entityType);
        const appearance = getEntityAppearance(appearanceType(entityType));
        return group.map((item) => ({
          id: `${entityType}:${item.id}`,
          title: item.name,
          icon: appearance.icon as keyof typeof Ionicons.glyphMap,
          color: appearance.color,
          onPress: navigableType ? () => handlePress(entityType, item.id) : undefined,
          testID: navigableType ? `related-entity-${item.id}` : undefined,
        }));
      }),
    [groupedEntities, handlePress],
  );

  return (
    <CollapsibleCard title={`${title} (${items.length})`} initialExpanded={false}>
      <EntityRelationList items={items} emptyText={noItemsMessage} />
    </CollapsibleCard>
  );
};

export default RelatedEntitiesList;
