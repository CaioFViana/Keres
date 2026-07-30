import React, { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';
import { ItemJourney, Item } from '@keres/shared/entities/Item';
import { Scene } from '@keres/shared/entities/Scene';
import GenericRelationDisplay from '../RelationManager/GenericRelationDisplay';
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
    return (
      <View style={{ flex: 1, paddingVertical: 10 }}>
        <Text style={{ fontSize: 16, color: colors.text }}>{actualItem.name}</Text>
        {journey.newState && <Text style={{ fontSize: 14, color: colors.textSecondary }}>{t('item_state')}: {journey.newState}</Text>}
        {allScenes?.find(scene => scene.id === journey.sceneId)?.name && (
          <Text style={{ fontSize: 14, color: colors.textSecondary }}>{t('scene')}: {allScenes.find(scene => scene.id === journey.sceneId)?.name}</Text>
        )}
        {newCharacterOwner && <Text style={{ fontSize: 14, color: colors.textSecondary }}>{t('new_owner')}: {newCharacterOwner.name}</Text>}
        {journey.extraNotes && <Text style={{ fontSize: 14, color: colors.textSecondary }}>{t('extra_notes')}: {journey.extraNotes}</Text>}
      </View>
    );
  }, [allScenes, allCharacters, colors.text, colors.textSecondary, t]);


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