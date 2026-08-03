import React, { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';
import { ItemJourney, Item } from '@keres/shared/entities/Item';
import { Scene } from '@keres/shared/entities/Scene';
import GenericRelationDisplay from '../RelationManager/GenericRelationDisplay';
import RelationAttributeLine from '../RelationManager/RelationAttributeLine';
import { useTheme } from '../../theme';
import { CharacterSelect } from '../../db/schema'; // Import CharacterSelect

interface ItemJourneyManagerProps {
  allItemJourneys: ItemJourney[]; // All item journeys in the story
  allItems: Item[]; // All items in the story to display item names
  allScenes: Scene[]; // All scenes in the story to display scene names
  allCharacters: CharacterSelect[]; // All characters in the story to display character names
  currentItemId: string;
}

const ItemJourneyManager: React.FC<ItemJourneyManagerProps> = ({
  allItemJourneys,
  allItems,
  allScenes,
  allCharacters, // Destructure allCharacters
  currentItemId,
}) => {
  const { t } = useTranslation();
  const { colors } = useTheme();

  const displayJourneys = useMemo(() => {
    return allItemJourneys.filter(journey => journey.itemId === currentItemId && !journey.isDeleted);
  }, [allItemJourneys, currentItemId]);

  const getItemForDisplay = useCallback((itemId: string) => {
    return allItems.find(item => item.id === itemId);
  }, [allItems]);

  const getRelationJourneyId = useCallback((journey: ItemJourney) => {
    return journey.itemId;
  }, []);

  const renderItemJourneyExtraContent = useCallback((journey: ItemJourney, actualItem: Item) => {
    const newCharacterOwner = allCharacters.find(char => char.id === journey.newCharacterOwnerId);
    const sceneName = allScenes?.find(scene => scene.id === journey.sceneId)?.name;
    return (
      <View>
        <Text style={{ fontSize: 16, fontWeight: '600', color: colors.text }}>{actualItem.name}</Text>
        {journey.newState && <RelationAttributeLine label={t('item_state')} value={journey.newState} />}
        {sceneName && <RelationAttributeLine label={t('scene')} value={sceneName} />}
        {newCharacterOwner && <RelationAttributeLine label={t('new_owner')} value={newCharacterOwner.name} />}
        {journey.extraNotes && <RelationAttributeLine label={t('extra_notes')} value={journey.extraNotes} />}
      </View>
    );
  }, [allScenes, allCharacters, colors.text, t]);


  return (
    <GenericRelationDisplay<Item, ItemJourney>
      relations={displayJourneys}
      getRelatedItem={getItemForDisplay}
      getRelationItemId={getRelationJourneyId}
      getItemDisplayName={item => item.name}
      noItemsMessage={'no_journeys_assigned_to_item'}
      renderItemExtraContent={renderItemJourneyExtraContent}
      title={t('item_journeys_title')}
    />
  );
};

export default ItemJourneyManager;