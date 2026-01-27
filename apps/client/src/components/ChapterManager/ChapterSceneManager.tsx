import React, { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { SceneSelect } from '../../db/schema'; // SceneSelect type
import { Location } from '@keres/shared/entities/Location'; // Import Location entity
import { useTheme } from '../../theme';
import GenericRelationDisplay, { BaseItem } from '../RelationManager/GenericRelationDisplay'; // Import GenericRelationDisplay

interface ChapterSceneManagerProps {
  currentChapterId: string;
  availableScenes: SceneSelect[];
  availableLocations: Location[]; // All locations in the story (to get location names)
}

const ChapterSceneManager: React.FC<ChapterSceneManagerProps> = ({
  currentChapterId,
  availableScenes,
  availableLocations, // Add this
}) => {
  const { t } = useTranslation();
  const { colors } = useTheme();

  const scenesInChapter = useMemo(() => {
    return availableScenes.filter(
      (scene) => scene.chapterId === currentChapterId && !scene.isDeleted
    ).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  }, [currentChapterId, availableScenes]);

  const getSceneById = useCallback((sceneId: string) => {
    return availableScenes.find(scene => scene.id === sceneId);
  }, [availableScenes]);

  const getSceneDisplayName = useCallback((scene: SceneSelect) => {
    return scene.name;
  }, []);

  return (
    <GenericRelationDisplay<SceneSelect, SceneSelect>
      relations={scenesInChapter}
      getRelatedItem={getSceneById}
      getRelationItemId={(scene) => scene.id}
      getItemDisplayName={getSceneDisplayName}
      noItemsMessage={'no_scenes_in_chapter'}
      renderItemExtraContent={(scene, relatedScene) => {
        const locationName = availableLocations.find(loc => loc.id === relatedScene.locationId)?.name;
        return (
          <View style={{ flex: 1, paddingVertical: 10 }}>
            <Text style={{ fontSize: 16, color: colors.text }}>{relatedScene.name}</Text>
            {relatedScene.summary && (
              <Text style={{ fontSize: 14, color: colors.textSecondary }}>
                {t('summary')}: {relatedScene.summary}
              </Text>
            )}
            {locationName && (
              <Text style={{ fontSize: 14, color: colors.textSecondary }}>
                {t('location')}: {locationName}
              </Text>
            )}
            {/* Add other scene details if needed */}
          </View>
        );
      }}
      title={t('scenes_in_chapter_title')}
    />
  );
};

export default ChapterSceneManager;