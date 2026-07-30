import React, { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';
import { ItemJourney, Item } from '@keres/shared/entities/Item';
import { Character } from '@keres/shared/entities/Character';
import GenericRelationDisplay from '../RelationManager/GenericRelationDisplay';
import { useTheme } from '../../theme';

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

  const itemJourneysForScene = useMemo(() => {
    return itemJourneys.filter(journey => journey.sceneId === currentSceneId && !journey.isDeleted);
  }, [itemJourneys, currentSceneId]);

  const getItemJourneyId = (relation: ItemJourney) => relation.itemId;

  const getItemById = (itemId: string) => allItems.find(item => item.id === itemId);

  const getItemDisplayName = (item: Item) => item.name;

  const renderItemJourneyExtraContent = useCallback((relation: ItemJourney, item: Item) => {
    const ownerName = allCharacters?.find(char => char.id === relation.newCharacterOwnerId)?.name;
    return (
      <View style={{ flex: 1, paddingVertical: 10 }}>
        <Text style={{ fontSize: 16, color: colors.text }}>{item.name}</Text>
        {relation.newState && <Text style={{ fontSize: 14, color: colors.textSecondary }}>{t('item_state')}: {relation.newState}</Text>}
        {ownerName && <Text style={{ fontSize: 14, color: colors.textSecondary }}>{t('new_owner')}: {ownerName}</Text>}
        {relation.extraNotes && <Text style={{ fontSize: 14, color: colors.textSecondary }}>{t('extra_notes')}: {relation.extraNotes}</Text>}
      </View>
    );
  }, [allCharacters, colors.text, colors.textSecondary, t]);


  return (
    <GenericRelationDisplay<Item, ItemJourney>
      relations={itemJourneysForScene}
      getRelatedItem={getItemById}
      getRelationItemId={getItemJourneyId}
      getItemDisplayName={getItemDisplayName}
      noItemsMessage={'no_items_assigned_to_scene'}
      renderItemExtraContent={renderItemJourneyExtraContent}
      title={t('items_title')}
    />
  );
};

export default ItemSceneManager;