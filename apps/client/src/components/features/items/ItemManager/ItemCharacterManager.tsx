import React, { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';
import type { ItemJourney, Item } from '@keres/shared/entities/Item';
import type { Scene } from '@keres/shared/entities/Scene';
import { useNavigateToEntityDetail } from '../../../../hooks/useNavigateToEntityDetail';
import GenericRelationDisplay from '@/src/components/features/relations/RelationManager/GenericRelationDisplay';
import RelationAttributeLine from '@/src/components/features/relations/RelationManager/RelationAttributeLine';
import { useTheme } from '../../../../theme';
import { useVocabularyEntityCopy } from '../../../../vocabulary/useVocabularyEntityCopy';

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
  const sceneCopy = useVocabularyEntityCopy('Scene');
  const { colors } = useTheme();
  const navigateToDetail = useNavigateToEntityDetail();

  const handleItemPress = useCallback(
    (item: Item) => {
      navigateToDetail('Item', item.id);
    },
    [navigateToDetail],
  );

  const displayItems = useMemo(() => {
    const ownedItems = allItems.filter(
      (item) => item.characterOwnerId === currentCharacterId && !item.isDeleted,
    );
    const ownedItemJourneys = allItemJourneys.filter(
      (journey) => journey.newCharacterOwnerId === currentCharacterId && !journey.isDeleted,
    );
    return [...ownedItems, ...ownedItemJourneys];
  }, [allItems, allItemJourneys, currentCharacterId]);

  const getItemForDisplay = useCallback(
    (itemId: string) => {
      return allItems.find((item) => item.id === itemId);
    },
    [allItems],
  );

  const getDisplayItemId = useCallback((entity: Item | ItemJourney) => {
    if (isItem(entity)) {
      return entity.id;
    }
    return entity.itemId;
  }, []);

  const renderItemExtraContent = useCallback(
    (entity: Item | ItemJourney, actualItem: Item) => {
      return (
        <View>
          <Text style={{ fontSize: 16, fontWeight: '600', color: colors.text }}>
            {actualItem.name}
          </Text>
          {isItem(entity) && (
            <>
              {actualItem.initialState && (
                <RelationAttributeLine label={t('initial_state')} value={actualItem.initialState} />
              )}
              {actualItem.extraNotes && (
                <RelationAttributeLine label={t('extra_notes')} value={actualItem.extraNotes} />
              )}
            </>
          )}
          {isItemJourney(entity) && (
            <>
              {entity.newState && (
                <RelationAttributeLine label={t('item_state')} value={entity.newState} />
              )}
              {allScenes?.find((scene) => scene.id === entity.sceneId)?.name && (
                <RelationAttributeLine
                  label={sceneCopy.entity}
                  value={allScenes.find((scene) => scene.id === entity.sceneId)!.name}
                />
              )}
              {entity.extraNotes && (
                <RelationAttributeLine label={t('extra_notes')} value={entity.extraNotes} />
              )}
            </>
          )}
        </View>
      );
    },
    [allScenes, colors.text, t],
  );

  return (
    <GenericRelationDisplay<Item, Item | ItemJourney>
      relations={displayItems}
      getRelatedItem={getItemForDisplay}
      getRelationItemId={getDisplayItemId}
      getItemDisplayName={(item) => item.name}
      noItemsMessage={'no_items_assigned_to_character'}
      renderItemExtraContent={renderItemExtraContent}
      title={t('items_title')}
      onItemPress={handleItemPress}
    />
  );
};

export default ItemCharacterManager;
