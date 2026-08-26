import React, { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';
import type { ItemJourney, Item } from '@keres/shared/entities/Item';
import type { Character } from '@keres/shared/entities/Character';
import { useNavigateToEntityDetail } from '../../../../hooks/useNavigateToEntityDetail';
import GenericRelationDisplay from '@/src/components/features/relations/RelationManager/GenericRelationDisplay';
import RelationAttributeLine from '@/src/components/features/relations/RelationManager/RelationAttributeLine';
import { useTheme } from '../../../../theme';

interface ItemSceneManagerProps {
  itemJourneys: ItemJourney[];
  allItems: Item[]; // All items in the story for display purposes
  allCharacters: Character[]; // All characters in the story for owner names
  currentSceneId: string;
}

const ItemSceneManager: React.FC<ItemSceneManagerProps> = ({
  itemJourneys,
  allItems,
  allCharacters,
  currentSceneId,
}) => {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const navigateToDetail = useNavigateToEntityDetail();

  const handleItemPress = useCallback(
    (item: Item) => {
      navigateToDetail('Item', item.id);
    },
    [navigateToDetail],
  );

  const itemJourneysForScene = useMemo(() => {
    return itemJourneys.filter(
      (journey) => journey.sceneId === currentSceneId && !journey.isDeleted,
    );
  }, [itemJourneys, currentSceneId]);

  const getItemJourneyId = (relation: ItemJourney) => relation.itemId;

  const getItemById = (itemId: string) => allItems.find((item) => item.id === itemId);

  const getItemDisplayName = (item: Item) => item.name;

  const renderItemJourneyExtraContent = useCallback(
    (relation: ItemJourney, item: Item) => {
      const ownerName = allCharacters?.find(
        (char) => char.id === relation.newCharacterOwnerId,
      )?.name;
      return (
        <View>
          <Text style={{ fontSize: 16, fontWeight: '600', color: colors.text }}>{item.name}</Text>
          {relation.newState && (
            <RelationAttributeLine label={t('item_state')} value={relation.newState} />
          )}
          {ownerName && <RelationAttributeLine label={t('new_owner')} value={ownerName} />}
          {relation.extraNotes && (
            <RelationAttributeLine label={t('extra_notes')} value={relation.extraNotes} />
          )}
        </View>
      );
    },
    [allCharacters, colors.text, t],
  );

  return (
    <GenericRelationDisplay<Item, ItemJourney>
      relations={itemJourneysForScene}
      getRelatedItem={getItemById}
      getRelationItemId={getItemJourneyId}
      getItemDisplayName={getItemDisplayName}
      noItemsMessage={'no_items_assigned_to_scene'}
      renderItemExtraContent={renderItemJourneyExtraContent}
      title={t('items_title')}
      onItemPress={handleItemPress}
    />
  );
};

export default ItemSceneManager;
