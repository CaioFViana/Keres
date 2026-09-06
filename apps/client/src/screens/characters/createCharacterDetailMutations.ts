import type { CharacterRelation } from '@keres/shared/entities/CharacterRelation';
import type { CharacterScene } from '@keres/shared/entities/CharacterScene';
import { AppAlert } from '../../utils/AppAlert';
import { entityEventEmitter } from '../../utils/EventEmitter';

export function createCharacterDetailMutations(props: any) {
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
      // Update local state and emit event
      setCharacterRelations((prev: any) => {
        const existingIndex = prev.findIndex((r: any) => r.id === savedRelation.id);
        if (existingIndex > -1) {
          return prev.map((r: any, index: number) => (index === existingIndex ? savedRelation : r));
        } else {
          return [...prev, savedRelation];
        }
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
      // Added !userId check
      AppAlert.alert(t('error'), t('service_not_initialized'));
      return;
    }
    try {
      const success = await characterRelationServiceRef.current.deleteCharacterRelation(
        userId,
        relationId,
      ); // Pass userId
      if (success) {
        setCharacterRelations((prev: any) => prev.filter((r: any) => r.id !== relationId));
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
      setCharacterSceneRelations((prev: any) => {
        const existingIndex = prev.findIndex((cs: any) => cs.id === savedCharacterScene.id);
        if (existingIndex > -1) {
          return prev.map((cs: any, index: number) =>
            index === existingIndex ? savedCharacterScene : cs,
          );
        } else {
          return [...prev, savedCharacterScene];
        }
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
        setCharacterSceneRelations((prev: any) =>
          prev.filter((cs: any) => cs.id !== characterSceneId),
        );
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
