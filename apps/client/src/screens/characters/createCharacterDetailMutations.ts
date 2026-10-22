import type { CharacterRelation } from '@keres/shared/entities/narrative/CharacterRelation';
import type { CharacterScene } from '@keres/shared/entities/narrative/CharacterScene';
import type { TFunction } from 'i18next';
import type { CharacterRelationServiceInterface } from '@/src/services/storymanagement/relations/CharacterRelationService';
import type { CharacterSceneServiceInterface } from '@/src/services/storymanagement/entities/CharacterSceneService';
import { AppAlert } from '@/src/state/ui/AppAlert';
import { entityEventEmitter } from '@/src/state/events/EventEmitter';
import { logger } from '@/src/utils/logging/logger';

export type CharacterDetailMutationsProps = {
  relationService: CharacterRelationServiceInterface;
  characterSceneService: CharacterSceneServiceInterface;
  character: { storyId: string } | null | undefined;
  userId: string | null | undefined;
  t: TFunction;
  characterId: string;
};

/**
 * What the character detail can change: its relations and its scenes. Each success is announced with
 * the change event, which is what reloads the lists on screen.
 */
export function createCharacterDetailMutations(props: CharacterDetailMutationsProps) {
  const { relationService, characterSceneService, character, userId, t, characterId } = props;
  const handleSaveRelation = async (relation: CharacterRelation) => {
    if (!character?.storyId || !userId) {
      AppAlert.alert(t('error'), t('service_not_initialized'));
      return;
    }
    try {
      await relationService.saveCharacterRelation(userId, relation);
      entityEventEmitter.emit('character_relation_changed', character.storyId, characterId);
      AppAlert.alert(t('success'), t('relation_saved_successfully'));
    } catch (error) {
      AppAlert.alert(t('error'), t('failed_to_save_relation'));
      logger.error('Failed to save character relation:', error);
    }
  };

  const handleDeleteRelation = async (relationId: string) => {
    if (!character?.storyId || !userId) {
      AppAlert.alert(t('error'), t('service_not_initialized'));
      return;
    }
    try {
      const success = await relationService.deleteCharacterRelation(userId, relationId);
      if (success) {
        entityEventEmitter.emit('character_relation_changed', character.storyId, characterId);
        AppAlert.alert(t('success'), t('relation_deleted_successfully'));
      } else {
        AppAlert.alert(t('error'), t('failed_to_delete_relation'));
      }
    } catch (error) {
      AppAlert.alert(t('error'), t('failed_to_delete_relation'));
      logger.error('Failed to delete character relation:', error);
    }
  };

  const handleSaveCharacterScene = async (characterScene: CharacterScene) => {
    if (!character?.storyId || !userId) {
      AppAlert.alert(t('error'), t('service_not_initialized'));
      return;
    }
    try {
      await characterSceneService.saveCharacterScene(userId, characterScene);
      entityEventEmitter.emit('character_scene_changed', character.storyId, characterId);
      AppAlert.alert(t('success'), t('character_scene_saved_successfully'));
    } catch (error) {
      AppAlert.alert(t('error'), t('failed_to_save_character_scene'));
      logger.error('Failed to save character scene:', error);
    }
  };

  const handleDeleteCharacterScene = async (characterSceneId: string) => {
    if (!character?.storyId || !userId) {
      AppAlert.alert(t('error'), t('service_not_initialized'));
      return;
    }
    try {
      const success = await characterSceneService.deleteCharacterScene(userId, characterSceneId);
      if (success) {
        entityEventEmitter.emit('character_scene_changed', character.storyId, characterId);
        AppAlert.alert(t('success'), t('character_scene_deleted_successfully'));
      } else {
        AppAlert.alert(t('error'), t('failed_to_delete_character_scene'));
      }
    } catch (error) {
      AppAlert.alert(t('error'), t('failed_to_delete_character_scene'));
      logger.error('Failed to delete character scene:', error);
    }
  };

  return {
    handleSaveRelation,
    handleDeleteRelation,
    handleSaveCharacterScene,
    handleDeleteCharacterScene,
  };
}
