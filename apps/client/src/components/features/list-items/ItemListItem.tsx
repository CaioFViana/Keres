import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { ItemSelect } from '../../../db/schemas/items';
import type { TagSelect } from '../../../db/schema';
import { useTheme } from '../../../theme';
import { truncate } from '../../../utils/stringUtils';

import GenericExpandedListItemWithActions from '@/src/components/common/lists/GenericExpandedListItemWithActions/GenericExpandedListItemWithActions';
import ListItemTitle from '@/src/components/features/list-items/ListItemTitle';
import TagList from '@/src/components/common/display/TagList/TagList';
import { createReferenceListItemStyles } from '@/src/components/features/list-items/styles/sharedListItemStyles';

interface ItemListItemProps {
  item: ItemSelect;
  onViewDetails: (itemId: string) => void;
  onToggleFavorite: (itemId: string, isFavorite: boolean) => void;
  renderJourneys?: () => React.ReactNode;
  tags?: TagSelect[];
}

const ItemListItem: React.FC<ItemListItemProps> = ({
  item,
  onViewDetails,
  onToggleFavorite,
  renderJourneys,
  tags = [],
}) => {
  const { colors } = useTheme();

  const referenceStyles = createReferenceListItemStyles(colors);
  const styles = StyleSheet.create({
    detailText: {
      fontSize: 14,
      color: colors.textSecondary,
      marginTop: 2,
    },
  });

  const renderHeaderContent = (currentItem: ItemSelect) => (
    <ListItemTitle
      text={currentItem.name}
      headerLeftStyle={referenceStyles.headerLeft}
      nameStyle={referenceStyles.name}
    />
  );

  const renderExpandedContent = (currentItem: ItemSelect) => (
    <View>
      {currentItem.description && (
        <Text style={referenceStyles.summaryText}>{truncate(currentItem.description, 200)}</Text>
      )}
      {currentItem.category && (
        <Text style={styles.detailText}>Category: {currentItem.category}</Text>
      )}
      {currentItem.initialState && (
        <Text style={styles.detailText}>Initial State: {currentItem.initialState}</Text>
      )}
      {currentItem.characterOwnerId && (
        <Text style={styles.detailText}>Owner: {truncate(currentItem.characterOwnerId, 50)}</Text>
      )}
      {tags.length > 0 && <TagList tags={tags} />}
      {renderJourneys?.()}
    </View>
  );

  return (
    <GenericExpandedListItemWithActions
      item={item}
      onViewDetails={onViewDetails}
      onToggleFavorite={onToggleFavorite}
      entityType="Item"
      renderHeaderContent={renderHeaderContent}
      renderExpandedContent={renderExpandedContent}
    />
  );
};

export default ItemListItem;
