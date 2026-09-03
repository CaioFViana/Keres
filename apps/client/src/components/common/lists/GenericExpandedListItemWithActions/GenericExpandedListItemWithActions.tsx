import { Ionicons } from '@expo/vector-icons';
import { getEntityAppearance, type EntityAppearance } from '@keres/shared';
import React, { useState } from 'react';
import { View } from 'react-native';

import GenericListItem from '@/src/components/common/lists/GenericListItem/GenericListItem';
import FavoriteButton from '@/src/components/common/lists/GenericExpandedListItemWithActions/Buttons/FavoriteButton';
import ViewDetailsButton from '@/src/components/common/lists/GenericExpandedListItemWithActions/Buttons/ViewDetailsButton';

interface GenericExpandedListItemWithActionsProps<T extends { id: string; isFavorite?: boolean }> {
  item: T;
  onToggleFavorite?: (itemId: string, isFavorite: boolean) => void;
  onViewDetails?: (itemId: string) => void;
  renderHeaderContent: (item: T) => React.ReactNode;
  renderExpandedContent: (item: T) => React.ReactNode;
  initialExpanded?: boolean;
  isExpanded?: boolean;
  onExpandedChange?: (isExpanded: boolean) => void;
  density?: 'default' | 'nested';
  /** Uses the shared icon and color assigned to this entity type. */
  entityType?: string;
  /** Overrides the entity type appearance when the item has a more specific subtype. */
  entityAppearance?: EntityAppearance;
}

const GenericExpandedListItemWithActions = <T extends { id: string; isFavorite?: boolean }>({
  item,
  onToggleFavorite,
  onViewDetails,
  renderHeaderContent,
  renderExpandedContent,
  initialExpanded = false,
  isExpanded: controlledIsExpanded,
  onExpandedChange,
  density = 'default',
  entityType,
  entityAppearance,
}: GenericExpandedListItemWithActionsProps<T>) => {
  const [uncontrolledIsOpen, setUncontrolledIsOpen] = useState(initialExpanded);
  const isOpen = controlledIsExpanded ?? uncontrolledIsOpen;

  React.useEffect(() => {
    if (controlledIsExpanded === undefined && initialExpanded) setUncontrolledIsOpen(true);
  }, [controlledIsExpanded, initialExpanded]);

  const toggleOpen = () => {
    const nextIsOpen = !isOpen;
    if (controlledIsExpanded === undefined) setUncontrolledIsOpen(nextIsOpen);
    onExpandedChange?.(nextIsOpen);
  };

  const rightActions = (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      {onViewDetails && <ViewDetailsButton onPress={() => onViewDetails(item.id)} />}
      {item.isFavorite !== undefined && onToggleFavorite && (
        <FavoriteButton
          isFavorite={item.isFavorite}
          onPress={() => onToggleFavorite(item.id, !item.isFavorite)}
        />
      )}
    </View>
  );
  const resolvedAppearance = entityAppearance ?? (entityType ? getEntityAppearance(entityType) : null);

  return (
    <GenericListItem
      headerContent={renderHeaderContent(item)}
      leadingIcon={
        resolvedAppearance ? (
          <Ionicons
            name={resolvedAppearance.icon as keyof typeof Ionicons.glyphMap}
            size={24}
            color={resolvedAppearance.color}
            testID="entity-list-item-icon"
          />
        ) : undefined
      }
      expandedContent={renderExpandedContent(item)}
      isOpen={isOpen}
      onPress={toggleOpen}
      rightActions={rightActions}
      density={density}
    />
  );
};

export default GenericExpandedListItemWithActions;
