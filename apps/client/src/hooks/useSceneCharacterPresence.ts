import type { CharacterScene } from '@keres/shared/entities/CharacterScene';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDrizzle } from '../db';
import { createCharacterSceneService } from '../services/storymanagement/CharacterSceneService';
import { useUserSettingsStore } from '../state/userSettingsStore';
import { AppAlert } from '../utils/AppAlert';
import { entityEventEmitter } from '../utils/EventEmitter';

export function useSceneCharacterPresence(
  sceneId: string | undefined,
  storyId: string | undefined,
) {
  const { t } = useTranslation();
  const drizzleDb = useDrizzle();
  const { userId } = useUserSettingsStore();
  const serviceRef = useRef<ReturnType<typeof createCharacterSceneService> | null>(null);
  const [characterSceneRelations, setCharacterSceneRelations] = useState<CharacterScene[]>([]);
  const [pendingCharacterSceneRelations, setPendingCharacterSceneRelations] = useState<
    CharacterScene[]
  >([]);

  useEffect(() => {
    if (drizzleDb && !serviceRef.current) {
      serviceRef.current = createCharacterSceneService(drizzleDb);
    }
  }, [drizzleDb]);

  const fetchCharacterSceneRelations = useCallback(async () => {
    if (!serviceRef.current || !storyId || !sceneId) {
      setCharacterSceneRelations([]);
      return;
    }
    try {
      setCharacterSceneRelations(await serviceRef.current.getRelationsForScene(storyId, sceneId));
    } catch (err) {
      console.error('Failed to fetch character-scene relations:', err);
    }
  }, [storyId, sceneId]);

  const handleSaveCharacterSceneRelation = async (relation: CharacterScene) => {
    if (!sceneId) {
      setPendingCharacterSceneRelations((prev) => {
        const existingIndex = prev.findIndex((item) => item.id === relation.id);
        return existingIndex > -1
          ? prev.map((item, index) => (index === existingIndex ? relation : item))
          : [...prev, relation];
      });
      AppAlert.alert(t('success'), t('character_scene_saved_successfully'));
      return;
    }
    if (!serviceRef.current || !storyId || !userId) {
      AppAlert.alert(t('error'), t('service_not_initialized'));
      return;
    }
    try {
      const saved = await serviceRef.current.saveCharacterScene(userId, relation);
      setCharacterSceneRelations((prev) => {
        const existingIndex = prev.findIndex((item) => item.id === saved.id);
        return existingIndex > -1
          ? prev.map((item, index) => (index === existingIndex ? saved : item))
          : [...prev, saved];
      });
      entityEventEmitter.emit('character_scene_changed', storyId, sceneId);
      AppAlert.alert(t('success'), t('character_scene_saved_successfully'));
    } catch (error) {
      AppAlert.alert(t('error'), t('failed_to_save_character_scene'));
      console.error('Failed to save character-scene relation:', error);
    }
  };

  const handleDeleteCharacterSceneRelation = async (relationId: string) => {
    if (!sceneId) {
      setPendingCharacterSceneRelations((prev) => prev.filter((item) => item.id !== relationId));
      AppAlert.alert(t('success'), t('character_scene_deleted_successfully'));
      return;
    }
    if (!serviceRef.current || !storyId || !userId) {
      AppAlert.alert(t('error'), t('service_not_initialized'));
      return;
    }
    try {
      const success = await serviceRef.current.deleteCharacterScene(userId, relationId);
      if (success) {
        setCharacterSceneRelations((prev) => prev.filter((item) => item.id !== relationId));
        entityEventEmitter.emit('character_scene_changed', storyId, sceneId);
        AppAlert.alert(t('success'), t('character_scene_deleted_successfully'));
      } else {
        AppAlert.alert(t('error'), t('failed_to_delete_character_scene'));
      }
    } catch (error) {
      AppAlert.alert(t('error'), t('failed_to_delete_character_scene'));
      console.error('Failed to delete character-scene relation:', error);
    }
  };

  const persistPendingCharacterSceneRelations = async (targetSceneId: string) => {
    if (!serviceRef.current || !storyId || !userId) return;
    for (const pending of pendingCharacterSceneRelations) {
      await serviceRef.current.saveCharacterScene(userId, { ...pending, sceneId: targetSceneId });
    }
    if (pendingCharacterSceneRelations.length > 0) {
      setPendingCharacterSceneRelations([]);
      entityEventEmitter.emit('character_scene_changed', storyId, targetSceneId);
    }
  };

  return {
    characterSceneRelations,
    pendingCharacterSceneRelations,
    fetchCharacterSceneRelations,
    handleSaveCharacterSceneRelation,
    handleDeleteCharacterSceneRelation,
    persistPendingCharacterSceneRelations,
  };
}
