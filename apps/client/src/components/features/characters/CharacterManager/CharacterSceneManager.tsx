import type { DrawerNavigationProp } from '@react-navigation/drawer';
import { useNavigation } from '@react-navigation/native';
import { CharacterScene } from '@keres/shared/entities/CharacterScene';
import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { SceneSelect } from '../../../../db/schema';
import type { MainSystemDrawerParamList } from '../../../../navigation/MainSystemStack';
import { createULID } from '../../../../utils/entityUtils';
import { navigateToEntityDetail } from '../../../../utils/entityNavigation';
import RelationManager from '@/src/components/features/relations/RelationManager/RelationManager';

interface CharacterSceneManagerProps {
  characterSceneRelations: CharacterScene[];
  availableScenes: SceneSelect[];
  onSave: (relation: CharacterScene) => Promise<void>;
  onDelete: (relationId: string) => Promise<void>;
  editable: boolean;
  currentStoryId: string;
  currentCharacterId: string;
}

const CharacterSceneManager: React.FC<CharacterSceneManagerProps> = ({
  characterSceneRelations,
  availableScenes,
  onSave,
  onDelete,
  editable,
  currentStoryId,
  currentCharacterId,
}) => {
  const { t } = useTranslation();
  const navigation = useNavigation();

  const handleScenePress = useCallback((scene: SceneSelect) => {
    const drawerNavigation = navigation.getParent<DrawerNavigationProp<MainSystemDrawerParamList>>();
    if (drawerNavigation) {
      navigateToEntityDetail(drawerNavigation, 'Scene', scene.id);
    }
  }, [navigation]);

  const createCharacterSceneRelationObject = (selectedSceneId: string, storyId: string, characterId: string): CharacterScene => {
    return {
      id: createULID(),
      storyId: storyId,
      characterId: characterId,
      sceneId: selectedSceneId,
      createdAt: new Date(),
      updatedAt: new Date(),
      version: 1,
      isDeleted: false,
      deletedAt: null,
    };
  };

  const getSceneIdFromRelation = (relation: CharacterScene) => relation.sceneId;

  const getSceneDisplayName = (scene: SceneSelect) => scene.name;

  const getSceneSearchableValue = (scene: SceneSelect) => scene.name;

  const filterAvailableScenes = (scene: SceneSelect, relations: CharacterScene[], getRelationItemId: (relation: CharacterScene) => string) => {
    return !scene.isDeleted && !relations.some(rel => getRelationItemId(rel) === scene.id);
  };

  return (
    <RelationManager<SceneSelect, CharacterScene>
      relations={characterSceneRelations}
      availableItems={availableScenes}
      onSave={onSave}
      onDelete={onDelete}
      editable={editable}
      currentStoryId={currentStoryId}
      currentEntityId={currentCharacterId}
      createRelationObject={createCharacterSceneRelationObject}
      getRelationItemId={getSceneIdFromRelation}
      getItemDisplayName={getSceneDisplayName}
      getItemSearchValue={getSceneSearchableValue}
      filterAvailableItems={filterAvailableScenes}
      selectItemPlaceholder={t('select_scene')}
      noItemsAssignedMessage={t('no_scenes_assigned_to_character')}
      itemAlreadyAddedMessage={t('scene_already_assigned_to_character')}
      selectItemToAddMessage={t('select_scene_to_add_to_character')}
      deleteConfirmationTitle={t('remove_scene_from_character_title')}
      deleteConfirmationMessage={t('remove_scene_from_character_message')}
      title={t('scenes_title')}
      onItemPress={handleScenePress}
    />
  );
};

export default CharacterSceneManager;
