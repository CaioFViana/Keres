import type { DrawerNavigationProp } from '@react-navigation/drawer';
import { useNavigation } from '@react-navigation/native';
import React, { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';
import { SceneSelect } from '../../../../db/schema'; // SceneSelect type
import { Location } from '@keres/shared/entities/Location'; // Import Location entity
import type { MainSystemDrawerParamList } from '../../../../navigation/MainSystemStack';
import { useTheme } from '../../../../theme';
import { navigateToEntityDetail } from '../../../../utils/entityNavigation';
import GenericRelationDisplay from '@/src/components/features/relations/RelationManager/GenericRelationDisplay'; // Import GenericRelationDisplay
import RelationAttributeLine from '@/src/components/features/relations/RelationManager/RelationAttributeLine';

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
  const navigation = useNavigation();

  const handleScenePress = useCallback((scene: SceneSelect) => {
    const drawerNavigation = navigation.getParent<DrawerNavigationProp<MainSystemDrawerParamList>>();
    if (drawerNavigation) {
      navigateToEntityDetail(drawerNavigation, 'Scene', scene.id);
    }
  }, [navigation]);

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
          <View>
            <Text style={{ fontSize: 16, fontWeight: '600', color: colors.text }}>{relatedScene.name}</Text>
            {relatedScene.summary && (
              <RelationAttributeLine label={t('summary')} value={relatedScene.summary} />
            )}
            {locationName && (
              <RelationAttributeLine label={t('location')} value={locationName} />
            )}
          </View>
        );
      }}
      title={t('scenes_in_chapter_title')}
      onItemPress={handleScenePress}
    />
  );
};

export default ChapterSceneManager;