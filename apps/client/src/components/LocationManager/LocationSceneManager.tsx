import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { SceneSelect } from '../../db/schema';
import GenericRelationDisplay from '../RelationManager/GenericRelationDisplay';

interface LocationSceneManagerProps {
  allScenes: SceneSelect[]; // All scenes in the story
  currentLocationId: string;
}

const LocationSceneManager: React.FC<LocationSceneManagerProps> = ({
  allScenes,
  currentLocationId,
}) => {
  const { t } = useTranslation();

  const scenesForLocation = useMemo(() => {
    return allScenes.filter(scene => scene.locationId === currentLocationId && !scene.isDeleted);
  }, [allScenes, currentLocationId]);

  const getSceneById = (sceneId: string) => allScenes.find(scene => scene.id === sceneId);
  const getSceneId = (scene: SceneSelect) => scene.id;
  const getSceneDisplayName = (scene: SceneSelect) => scene.name;

  return (
    <GenericRelationDisplay<SceneSelect, SceneSelect>
      relations={scenesForLocation}
      getRelatedItem={getSceneById}
      getRelationItemId={getSceneId}
      getItemDisplayName={getSceneDisplayName}
      noItemsMessage={'no_scenes_assigned_to_location'}
      title={t('scenes_title')}
    />
  );
};

export default LocationSceneManager;
