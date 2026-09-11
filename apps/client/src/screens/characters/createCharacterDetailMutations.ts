import type { CharacterRelation } from '@keres/shared/entities/CharacterRelation';
import type { CharacterScene } from '@keres/shared/entities/CharacterScene';
import type { Dispatch, RefObject, SetStateAction } from 'react';
import type { TFunction } from 'i18next';
import type { CharacterRelationServiceInterface } from '../../services/storymanagement/CharacterRelationService';
import type { CharacterSceneServiceInterface } from '../../services/storymanagement/CharacterSceneService';
import { AppAlert } from '../../utils/AppAlert';
import { entityEventEmitter } from '../../utils/EventEmitter';

export type CharacterDetailMutationsProps = {
  characterRelationServiceRef: RefObject<CharacterRelationServiceInterface | null>;
  characterSceneServiceRef: RefObject<CharacterSceneServiceInterface | null>;
  character: { storyId: string } | null | undefined;
  userId: string | null | undefined;
  t: TFunction;
  characterId: string;
  setCharacterRelations: Dispatch<SetStateAction<CharacterRelation[]>>;
  setCharacterSceneRelations: Dispatch<SetStateAction<CharacterScene[]>>;
};

export function createCharacterDetailMutations(props: CharacterDetailMutationsProps) {
  const {
    characterRelationServiceRef,
    characterSceneServiceRef,
    character,
    userId,
    t,
    characterId,
    setCharacterRelations,
    setCharacterSceneRelations,
  } = props;
  const handleSaveRelation = async (relation: CharacterRelation) => {
    if (!characterRelationServiceRef.current || !character?.storyId || !userId) {
      AppAlert.alert(t('error'), t('service_not_initialized'));
      return;
    }
    try {
      const savedRelation = await characterRelationServiceRef.current.saveCharacterRelation(
        userId,
        relation,
      );
      setCharacterRelations((prev) => {
        const existingIndex = prev.findIndex((r) => r.id === savedRelation.id);
        if (existingIndex > -1) {
          return prev.map((r, index) => (index === existingIndex ? savedRelation : r));
        }
        return [...prev, savedRelation];
      });
      entityEventEmitter.emit('character_relation_changed', character?.storyId, characterId);
      AppAlert.alert(t('success'), t('relation_saved_successfully'));
    } catch (error) {
      AppAlert.alert(t('error'), t('failed_to_save_relation'));
      console.error('Failed to save character relation:', error);
    }
  };

  const handleDeleteRelation = async (relationId: string) => {
    if (!characterRelationServiceRef.current || !character?.storyId || !userId) {
      AppAlert.alert(t('error'), t('service_not_initialized'));
      return;
    }
    try {
      const success = await characterRelationServiceRef.current.deleteCharacterRelation(
        userId,
        relationId,
      );
      if (success) {
        setCharacterRelations((prev) => prev.filter((r) => r.id !== relationId));
        entityEventEmitter.emit('character_relation_changed', character?.storyId, characterId);
        AppAlert.alert(t('success'), t('relation_deleted_successfully'));
      } else {
        AppAlert.alert(t('error'), t('failed_to_delete_relation'));
      }
    } catch (error) {
      AppAlert.alert(t('error'), t('failed_to_delete_relation'));
      console.error('Failed to delete character relation:', error);
    }
  };

  const handleSaveCharacterScene = async (characterScene: CharacterScene) => {
    if (!characterSceneServiceRef.current || !character?.storyId || !userId) {
      AppAlert.alert(t('error'), t('service_not_initialized'));
      return;
    }
    try {
      const savedCharacterScene = await characterSceneServiceRef.current.saveCharacterScene(
        userId,
        characterScene,
      );
      setCharacterSceneRelations((prev) => {
        const existingIndex = prev.findIndex((cs) => cs.id === savedCharacterScene.id);
        if (existingIndex > -1) {
          return prev.map((cs, index) => (index === existingIndex ? savedCharacterScene : cs));
        }
        return [...prev, savedCharacterScene];
      });
      entityEventEmitter.emit('character_scene_changed', character?.storyId, characterId);
      AppAlert.alert(t('success'), t('character_scene_saved_successfully'));
    } catch (error) {
      AppAlert.alert(t('error'), t('failed_to_save_character_scene'));
      console.error('Failed to save character scene:', error);
    }
  };

  const handleDeleteCharacterScene = async (characterSceneId: string) => {
    if (!characterSceneServiceRef.current || !character?.storyId || !userId) {
      AppAlert.alert(t('error'), t('service_not_initialized'));
      return;
    }
    try {
      const success = await characterSceneServiceRef.current.deleteCharacterScene(
        userId,
        characterSceneId,
      );
      if (success) {
        setCharacterSceneRelations((prev) => prev.filter((cs) => cs.id !== characterSceneId));
        entityEventEmitter.emit('character_scene_changed', character?.storyId, characterId);
        AppAlert.alert(t('success'), t('character_scene_deleted_successfully'));
      } else {
        AppAlert.alert(t('error'), t('failed_to_delete_character_scene'));
      }
    } catch (error) {
      AppAlert.alert(t('error'), t('failed_to_delete_character_scene'));
      console.error('Failed to delete character scene:', error);
    }
  };

  return {
    handleSaveRelation,
    handleDeleteRelation,
    handleSaveCharacterScene,
    handleDeleteCharacterScene,
  };
}
