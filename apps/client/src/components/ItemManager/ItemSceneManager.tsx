import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native'; // Added imports
import { ItemJourney } from '@keres/shared/entities/Item';
import { SceneSelect } from '../../db/schema';
import { Character } from '@keres/shared/entities/Character'; // Needed to display character name if newCharacterOwnerId is present
import GenericRelationDisplay from '../RelationManager/GenericRelationDisplay';
import { useTheme } from '../../theme'; // Added import

interface ItemSceneManagerProps {
  itemSceneRelations: ItemJourney[];
  allScenes: SceneSelect[]; // Now allScenes, similar to LocationSceneManager
  availableCharacters?: Character[]; // Optional: for displaying character names
}

const ItemSceneManager: React.FC<ItemSceneManagerProps> = ({
  itemSceneRelations,
  allScenes,
  availableCharacters,
}) => {
  const { t } = useTranslation();
  const { colors } = useTheme(); // Added useTheme

  const getSceneId = (relation: ItemJourney) => relation.sceneId;
  const getSceneById = (sceneId: string) => allScenes.find(scene => scene.id === sceneId);
  const getSceneDisplayName = (scene: SceneSelect) => scene.name;

  const renderItemExtraContent = (relation: ItemJourney, scene: SceneSelect) => {
    const ownerName = availableCharacters?.find(char => char.id === relation.newCharacterOwnerId)?.name;
    return (
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 16, color: colors.text }}>{scene.name}</Text>
        {relation.newState && <Text style={{ fontSize: 14, color: colors.textSecondary }}>{t('item_state')}: {relation.newState}</Text>}
        {ownerName && <Text style={{ fontSize: 14, color: colors.textSecondary }}>{t('new_owner')}: {ownerName}</Text>}
        {relation.extraNotes && <Text style={{ fontSize: 14, color: colors.textSecondary }}>{t('extra_notes')}: {relation.extraNotes}</Text>}
      </View>
    );
  };

  return (
    <GenericRelationDisplay<SceneSelect, ItemJourney>
      relations={itemSceneRelations}
      getRelatedItem={getSceneById}
      getRelationItemId={getSceneId}
      getItemDisplayName={getSceneDisplayName}
      noItemsMessage={'no_scenes_assigned_to_item'}
      renderItemExtraContent={renderItemExtraContent}
      title={t('scenes_title')}
    />
  );
};

export default ItemSceneManager;
