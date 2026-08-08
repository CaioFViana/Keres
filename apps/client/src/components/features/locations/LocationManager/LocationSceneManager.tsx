import type { DrawerNavigationProp } from '@react-navigation/drawer';
import { useNavigation } from '@react-navigation/native';
import React, { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';
import { SceneSelect } from '../../../../db/schema'; // SceneSelect type
import type { MainSystemDrawerParamList } from '../../../../navigation/MainSystemStack';
import { useTheme } from '../../../../theme';
import { navigateToEntityDetail } from '../../../../utils/entityNavigation';
import GenericRelationDisplay from '@/src/components/features/relations/RelationManager/GenericRelationDisplay'; // Import GenericRelationDisplay
import RelationAttributeLine from '@/src/components/features/relations/RelationManager/RelationAttributeLine';

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
  const navigation = useNavigation();

  const handleScenePress = useCallback((scene: SceneSelect) => {
    const drawerNavigation = navigation.getParent<DrawerNavigationProp<MainSystemDrawerParamList>>();
    if (drawerNavigation) {
      navigateToEntityDetail(drawerNavigation, 'Scene', scene.id);
    }
  }, [navigation]);

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
        <View>
          <Text style={{ fontSize: 16, fontWeight: '600', color: colors.text }}>{relatedScene.name}</Text>
          {relatedScene.summary && (
            <RelationAttributeLine label={t('summary')} value={relatedScene.summary} />
          )}
        </View>
      )}
      title={t('scenes_in_location_title')}
      onItemPress={handleScenePress}
    />
  );
};

export default LocationSceneManager;