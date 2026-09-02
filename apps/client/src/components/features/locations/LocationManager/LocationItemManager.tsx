import { getEntityAppearance } from '@keres/shared';
import React, { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';
import type { ItemJourney, Item } from '@keres/shared/entities/Item';
import type { SceneSelect } from '../../../../db/schema'; // SceneSelect type
import type { CharacterSelect } from '../../../../db/schemas/characters'; // CharacterSelect type
import { useNavigateToEntityDetail } from '../../../../hooks/useNavigateToEntityDetail';
import { useTheme } from '../../../../theme';
import { useVocabularyEntityCopy } from '../../../../vocabulary/useVocabularyEntityCopy';
import type { BaseRelation } from '@/src/components/features/relations/RelationManager/GenericRelationDisplay';
import GenericRelationDisplay from '@/src/components/features/relations/RelationManager/GenericRelationDisplay'; // Import GenericRelationDisplay and Base types
import RelationAttributeLine from '@/src/components/features/relations/RelationManager/RelationAttributeLine';

// Define the relation type for GenericRelationDisplay
interface ItemInLocationRelation extends BaseRelation {
  itemId: string;
  journeys: ItemJourney[]; // ItemJourneys that happened at this location
}

interface LocationItemManagerProps {
  currentLocationId: string;
  availableItemJourneys: ItemJourney[]; // All item journeys in the story
  availableItems: Item[]; // All items in the story (to get item details)
  availableScenes: SceneSelect[]; // All scenes in the story (to link journeys to locations)
  availableCharacters: CharacterSelect[]; // All characters in the story (to get owner names)
}

const LocationItemManager: React.FC<LocationItemManagerProps> = ({
  currentLocationId,
  availableItemJourneys,
  availableItems,
  availableScenes,
  availableCharacters, // Add this
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

  const itemsAsRelations = useMemo(() => {
    // 1. Get scenes relevant to the current location
    const scenesInCurrentLocation = availableScenes.filter(
      (scene) => scene.locationId === currentLocationId && !scene.isDeleted,
    );

    // 2. Filter item journeys to those that happened in scenes in the current location
    const journeysInCurrentLocation = availableItemJourneys.filter(
      (journey) =>
        scenesInCurrentLocation.some((scene) => scene.id === journey.sceneId) && !journey.isDeleted,
    );

    // 3. Group journeys by itemId
    const groupedByItem = new Map<string, ItemJourney[]>();

    journeysInCurrentLocation.forEach((journey) => {
      if (!groupedByItem.has(journey.itemId)) {
        groupedByItem.set(journey.itemId, []);
      }
      groupedByItem.get(journey.itemId)?.push(journey);
    });

    // 4. Transform into an array of ItemInLocationRelation objects
    const relations: ItemInLocationRelation[] = [];
    Array.from(groupedByItem.entries())
      .sort(([, aJourneys], [, bJourneys]) => {
        const aItem = availableItems.find((item) => item.id === aJourneys[0].itemId);
        const bItem = availableItems.find((item) => item.id === bJourneys[0].itemId);
        return (aItem?.name || '').localeCompare(bItem?.name || '');
      })
      .forEach(([itemId, journeys]) => {
        // Sort journeys by createdAt for consistent display
        journeys.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
        relations.push({
          id: itemId, // Use itemId as the ID for this relation
          itemId: itemId,
          journeys: journeys,
          isDeleted: false, // This relation itself is not "deleted"
        });
      });

    return relations;
  }, [currentLocationId, availableItemJourneys, availableItems, availableScenes]);

  const getItemById = useCallback(
    (itemId: string) => {
      return availableItems.find((item) => item.id === itemId);
    },
    [availableItems],
  );

  const getItemDisplayName = useCallback((item: Item) => {
    return item.name;
  }, []);

  const renderItemExtraContent = useCallback(
    (relation: ItemInLocationRelation, relatedItem: Item) => {
      return (
        <View>
          <Text style={{ fontSize: 16, fontWeight: '600', color: colors.text }}>
            {relatedItem.name}
          </Text>
          {relation.journeys.map((journey) => {
            const scene = availableScenes.find((s) => s.id === journey.sceneId);
            const newOwner = availableCharacters.find(
              (char) => char.id === journey.newCharacterOwnerId,
            );
            return (
              <View key={journey.id}>
                <RelationAttributeLine
                  label={sceneCopy.entity}
                  value={scene?.name || t('unknown_scene')}
                />
                {journey.newState && (
                  <RelationAttributeLine label={t('item_state')} value={journey.newState} />
                )}
                {newOwner && <RelationAttributeLine label={t('new_owner')} value={newOwner.name} />}
                {journey.extraNotes && (
                  <RelationAttributeLine label={t('extra_notes')} value={journey.extraNotes} />
                )}
              </View>
            );
          })}
        </View>
      );
    },
    [availableScenes, availableCharacters, colors.text, sceneCopy.entity, t],
  );

  return (
    <GenericRelationDisplay<Item, ItemInLocationRelation>
      relations={itemsAsRelations}
      getRelatedItem={getItemById}
      getRelationItemId={(relation) => relation.itemId}
      getItemDisplayName={getItemDisplayName}
      noItemsMessage={'no_items_in_location'}
      renderItemExtraContent={renderItemExtraContent}
      title={t('items_in_location_title')}
      onItemPress={handleItemPress}
      icon="cube"
      color={getEntityAppearance('Item').color}
    />
  );
};

export default LocationItemManager;
