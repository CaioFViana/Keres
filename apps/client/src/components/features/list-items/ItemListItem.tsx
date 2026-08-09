import React from 'react';
import { Text, View } from 'react-native';
import { ItemSelect } from '../../../db/schemas/items';
import { useTheme } from '../../../theme';
import { truncate } from '../../../utils/stringUtils';

import GenericExpandedListItemWithActions from '@/src/components/common/lists/GenericExpandedListItemWithActions/GenericExpandedListItemWithActions';
import { createItemStyles } from '@/src/components/features/list-items/styles/itemListItemStyles';

interface ItemListItemProps {
  item: ItemSelect;
  onViewDetails: (itemId: string) => void;
}

const ItemListItem: React.FC<ItemListItemProps> = ({ item, onViewDetails }) => {
  const { colors } = useTheme();

  const styles = createItemStyles(colors);

  const renderHeaderContent = (currentItem: ItemSelect) => (
    <View style={styles.headerLeft}>
      <Text style={styles.name} numberOfLines={1} ellipsizeMode="tail">
        {currentItem.name}
      </Text>
    </View>
  );

  const renderExpandedContent = (currentItem: ItemSelect) => (
    <View>
      {currentItem.description && <Text style={styles.summaryText}>{truncate(currentItem.description, 200)}</Text>}
      {currentItem.category && <Text style={styles.detailText}>Category: {currentItem.category}</Text>}
      {currentItem.initialState && <Text style={styles.detailText}>Initial State: {currentItem.initialState}</Text>}
      {currentItem.characterOwnerId && <Text style={styles.detailText}>Owner: {truncate(currentItem.characterOwnerId, 50)}</Text>}
    </View>
  );

  return (
    <GenericExpandedListItemWithActions
      item={item}
      onViewDetails={onViewDetails}
      renderHeaderContent={renderHeaderContent}
      renderExpandedContent={renderExpandedContent}
    />
  );
};

export default ItemListItem;