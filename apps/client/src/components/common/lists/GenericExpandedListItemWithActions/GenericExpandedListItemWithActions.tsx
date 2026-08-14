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
}

const GenericExpandedListItemWithActions = <T extends { id: string; isFavorite?: boolean }>({
  item,
  onToggleFavorite,
  onViewDetails,
  renderHeaderContent,
  renderExpandedContent,
  initialExpanded = false,
}: GenericExpandedListItemWithActionsProps<T>) => {
  const [isOpen, setIsOpen] = useState(initialExpanded);

  const toggleOpen = () => setIsOpen(!isOpen);

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

  return (
    <GenericListItem
      headerContent={renderHeaderContent(item)}
      expandedContent={renderExpandedContent(item)}
      isOpen={isOpen}
      onPress={toggleOpen}
      rightActions={rightActions}
    />
  );
};

export default GenericExpandedListItemWithActions;
