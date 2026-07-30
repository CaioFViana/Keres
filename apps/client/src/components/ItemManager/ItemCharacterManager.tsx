import React, { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';
import { ItemJourney, Item } from '@keres/shared/entities/Item';
import { Scene } from '@keres/shared/entities/Scene';
import GenericRelationDisplay from '../RelationManager/GenericRelationDisplay';
import { useTheme } from '../../theme';

// Type Guards
const isItemJourney = (entity: Item | ItemJourney): entity is ItemJourney => {
  return (entity as ItemJourney).itemId !== undefined;
};

const isItem = (entity: Item | ItemJourney): entity is Item => {
  return (entity as Item).characterOwnerId !== undefined;
};

interface ItemCharacterManagerProps {
  allItemJourneys: ItemJourney[]; // All item journeys in the story
  allItems: Item[]; // All items in the story
  allScenes: Scene[]; // All scenes in the story to display scene names
  currentCharacterId: string;
}

const ItemCharacterManager: React.FC<ItemCharacterManagerProps> = ({
  allItemJourneys,
  allItems,
  allScenes,
  currentCharacterId,
}) => {
  const { t } = useTranslation();
  const { colors } = useTheme();

  const displayItems = useMemo(() => {
    const ownedItems = allItems.filter(item => item.characterOwnerId === currentCharacterId && !item.isDeleted);
    const ownedItemJourneys = allItemJourneys.filter(journey => journey.newCharacterOwnerId === currentCharacterId && !journey.isDeleted);
    return [...ownedItems, ...ownedItemJourneys];
  }, [allItems, allItemJourneys, currentCharacterId]);

  const getItemForDisplay = useCallback((itemId: string) => {
    return allItems.find(item => item.id === itemId);
  }, [allItems]);

  const getDisplayItemId = useCallback((entity: Item | ItemJourney) => {
    if (isItem(entity)) {
      return entity.id;
    }
    return entity.itemId;
  }, []);

  const renderItemExtraContent = useCallback((entity: Item | ItemJourney, actualItem: Item) => {
    return (
      <View style={{ flex: 1, paddingVertical: 10 }}>
        <Text style={{ fontSize: 16, color: colors.text }}>{actualItem.name}</Text>
        {isItem(entity) && (
          <>
            {actualItem.initialState && <Text style={{ fontSize: 14, color: colors.textSecondary }}>{t('initial_state')}: {actualItem.initialState}</Text>}
            {actualItem.extraNotes && <Text style={{ fontSize: 14, color: colors.textSecondary }}>{t('extra_notes')}: {actualItem.extraNotes}</Text>}
          </>
        )}
        {isItemJourney(entity) && (
          <>
            {entity.newState && <Text style={{ fontSize: 14, color: colors.textSecondary }}>{t('item_state')}: {entity.newState}</Text>}
            {allScenes?.find(scene => scene.id === entity.sceneId)?.name && (
              <Text style={{ fontSize: 14, color: colors.textSecondary }}>{t('scene')}: {allScenes.find(scene => scene.id === entity.sceneId)?.name}</Text>
            )}
            {entity.extraNotes && <Text style={{ fontSize: 14, color: colors.textSecondary }}>{t('extra_notes')}: {entity.extraNotes}</Text>}
          </>
        )}
      </View>
    );
  }, [allScenes, colors.text, colors.textSecondary, t]);


  return (
    <GenericRelationDisplay<Item, Item | ItemJourney>
      relations={displayItems}
      getRelatedItem={getItemForDisplay}
      getRelationItemId={getDisplayItemId}
      getItemDisplayName={item => item.name}
      noItemsMessage={'no_items_assigned_to_character'}
      renderItemExtraContent={renderItemExtraContent}
      title={t('items_title')}
    />
  );
};

export default ItemCharacterManager;
