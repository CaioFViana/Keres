import type { CharacterScene } from '@keres/shared/entities/CharacterScene';
import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';
import type { SceneSelect } from '../../../../db/schema';
import { useChapterNames } from '../../../../hooks/useChapterNames';
import { useNavigateToEntityDetail } from '../../../../hooks/useNavigateToEntityDetail';
import { useTheme } from '../../../../theme';
import { useVocabularyEntityCopy } from '../../../../vocabulary/useVocabularyEntityCopy';
import { createULID } from '../../../../utils/entityUtils';
import RelationAttributeLine from '@/src/components/features/relations/RelationManager/RelationAttributeLine';
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
  const sceneCopy = useVocabularyEntityCopy('Scene');
  const chapterCopy = useVocabularyEntityCopy('Chapter');
  const { colors } = useTheme();
  const navigateToDetail = useNavigateToEntityDetail();
  const chapterNameOf = useChapterNames(availableScenes);

  const handleScenePress = useCallback(
    (scene: SceneSelect) => {
      navigateToDetail('Scene', scene.id);
    },
    [navigateToDetail],
  );

  const createCharacterSceneRelationObject = (
    selectedSceneId: string,
    storyId: string,
    characterId: string,
  ): CharacterScene => {
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

  const filterAvailableScenes = (
    scene: SceneSelect,
    relations: CharacterScene[],
    getRelationItemId: (relation: CharacterScene) => string,
  ) => {
    return !scene.isDeleted && !relations.some((rel) => getRelationItemId(rel) === scene.id);
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
      selectItemPlaceholder={sceneCopy.select}
      noItemsAssignedMessage={t('no_scenes_assigned_to_character')}
      itemAlreadyAddedMessage={t('scene_already_assigned_to_character')}
      selectItemToAddMessage={t('select_scene_to_add_to_character')}
      deleteConfirmationTitle={t('remove_scene_from_character_title')}
      deleteConfirmationMessage={t('remove_scene_from_character_message')}
      renderRelationItemExtraContent={(relation, scenes) => {
        const scene = scenes.find((candidate) => candidate.id === relation.sceneId);
        if (!scene) return null;
        const chapterName = chapterNameOf(scene.chapterId);
        return (
          <View>
            <Text style={{ fontSize: 16, color: colors.text }}>{scene.name}</Text>
            {chapterName ? (
              <RelationAttributeLine label={chapterCopy.entity} value={chapterName} />
            ) : null}
          </View>
        );
      }}
      title={sceneCopy.entities}
      onItemPress={handleScenePress}
    />
  );
};

export default CharacterSceneManager;
