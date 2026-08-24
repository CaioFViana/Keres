import type { Character } from '@keres/shared/entities/Character';
import type { CharacterScene } from '@keres/shared/entities/CharacterScene';
import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigateToEntityDetail } from '../../../../hooks/useNavigateToEntityDetail';
import { createULID } from '../../../../utils/entityUtils';
import RelationManager from '@/src/components/features/relations/RelationManager/RelationManager'; // Removed BaseItem, BaseRelation

interface SceneCharacterManagerProps {
  characterRelations: CharacterScene[];
  availableCharacters: Character[];
  onSave: (relation: CharacterScene) => Promise<void>;
  onDelete: (relationId: string) => Promise<void>;
  editable: boolean;
  currentStoryId: string;
  currentSceneId: string; // The ID of the scene this character is related to
}

/** Personagens presentes nesta Cena, vista do lado da Cena - o irmão de `CharacterSceneManager`,
 * que é a mesma relação (Character-Scene) vista do lado do Personagem. */
const SceneCharacterManager: React.FC<SceneCharacterManagerProps> = ({
  characterRelations,
  availableCharacters,
  onSave,
  onDelete,
  editable,
  currentStoryId,
  currentSceneId,
}) => {
  const { t } = useTranslation();
  const navigateToDetail = useNavigateToEntityDetail();

  const handleCharacterPress = useCallback(
    (character: Character) => {
      navigateToDetail('Character', character.id);
    },
    [navigateToDetail],
  );

  const createCharacterSceneRelationObject = (
    selectedCharacterId: string,
    storyId: string,
    sceneId: string,
  ): CharacterScene => {
    return {
      id: createULID(),
      storyId: storyId,
      characterId: selectedCharacterId,
      sceneId: sceneId,
      createdAt: new Date(),
      updatedAt: new Date(),
      version: 1,
      isDeleted: false,
      deletedAt: null,
    };
  };

  const getCharacterIdFromRelation = (relation: CharacterScene) => relation.characterId;

  const getCharacterName = (character: Character) => character.name;

  const getCharacterSearchableName = (character: Character) => character.name;

  const filterAvailableCharacters = (
    character: Character,
    relations: CharacterScene[],
    getRelationItemId: (relation: CharacterScene) => string,
  ) => {
    return (
      !character.isDeleted && !relations.some((rel) => getRelationItemId(rel) === character.id)
    );
  };

  return (
    <RelationManager<Character, CharacterScene>
      relations={characterRelations}
      availableItems={availableCharacters}
      onSave={onSave}
      onDelete={onDelete}
      editable={editable}
      currentStoryId={currentStoryId}
      currentEntityId={currentSceneId} // currentSceneId is the entity being related TO
      createRelationObject={createCharacterSceneRelationObject}
      getRelationItemId={getCharacterIdFromRelation}
      getItemDisplayName={getCharacterName}
      getItemSearchValue={getCharacterSearchableName}
      filterAvailableItems={filterAvailableCharacters}
      selectItemPlaceholder={t('select_character')}
      noItemsAssignedMessage={t('no_characters_assigned')}
      itemAlreadyAddedMessage={t('character_already_added_to_scene')}
      selectItemToAddMessage={t('select_character_to_add')}
      deleteConfirmationTitle={t('delete_character_from_scene_title')}
      deleteConfirmationMessage={t('delete_character_from_scene_message')}
      title={t('characters_title')}
      onItemPress={handleCharacterPress}
    />
  );
};

export default SceneCharacterManager;
