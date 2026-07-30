import React, { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';
import { SceneSelect } from '../../db/schema'; // SceneSelect type
import { useTheme } from '../../theme';
import GenericRelationDisplay from '../RelationManager/GenericRelationDisplay'; // Import GenericRelationDisplay

interface LocationSceneManagerProps {
  currentLocationId: string;
  availableScenes: SceneSelect[];
}

const LocationSceneManager: React.FC<LocationSceneManagerProps> = ({
  currentLocationId,
  availableScenes,
}) => {
  const { t } = useTranslation();
  const { colors } = useTheme();

  const scenesInLocation = useMemo(() => {
    return availableScenes.filter(
      (scene) => scene.locationId === currentLocationId && !scene.isDeleted
    ).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  }, [currentLocationId, availableScenes]);

  const getSceneById = useCallback((sceneId: string) => {
    return availableScenes.find(scene => scene.id === sceneId);
  }, [availableScenes]);

  const getSceneDisplayName = useCallback((scene: SceneSelect) => {
    return scene.name;
  }, []);

  // For this component, the "relation" is simply the scene itself, so TItem and TRelation are both SceneSelect
  return (
    <GenericRelationDisplay<SceneSelect, SceneSelect>
      relations={scenesInLocation}
      getRelatedItem={getSceneById}
      getRelationItemId={(scene) => scene.id}
      getItemDisplayName={getSceneDisplayName}
      noItemsMessage={'no_scenes_in_location'}
      renderItemExtraContent={(scene, relatedScene) => (
        <View style={{ flex: 1, paddingVertical: 10 }}>
          <Text style={{ fontSize: 16, color: colors.text }}>{relatedScene.name}</Text>
          {relatedScene.summary && (
            <Text style={{ fontSize: 14, color: colors.textSecondary }}>
              {t('summary')}: {relatedScene.summary}
            </Text>
          )}
          {/* Add other scene details if needed */}
        </View>
      )}
      title={t('scenes_in_location_title')}
    />
  );
};

export default LocationSceneManager;