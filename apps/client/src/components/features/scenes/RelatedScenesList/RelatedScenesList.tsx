import React, { useCallback, useMemo } from 'react';
import { Text, View } from 'react-native';
import type { SceneSelect } from '@/src/db/schema';
import { useNavigateToEntityDetail } from '@/src/hooks/useNavigateToEntityDetail';
import { useTheme } from '@/src/theme';
import GenericRelationDisplay from '@/src/components/features/relations/RelationManager/GenericRelationDisplay';
import RelationAttributeLine from '@/src/components/features/relations/RelationManager/RelationAttributeLine';

interface SceneDetail {
  label: string;
  value: string;
}

interface RelatedScenesListProps {
  scenes: SceneSelect[];
  matchesScene: (scene: SceneSelect) => boolean;
  title: string;
  noItemsMessage: string;
  getDetails?: (scene: SceneSelect) => SceneDetail[];
  sortScenes?: (a: SceneSelect, b: SceneSelect) => number;
}

/** Lista colapsável de cenas relacionadas a uma entidade, com navegação para o detalhe da cena. */
const RelatedScenesList: React.FC<RelatedScenesListProps> = ({
  scenes,
  matchesScene,
  title,
  noItemsMessage,
  getDetails,
  sortScenes,
}) => {
  const { colors } = useTheme();
  const navigateToDetail = useNavigateToEntityDetail();

  const relatedScenes = useMemo(
    () =>
      scenes
        .filter((scene) => !scene.isDeleted && matchesScene(scene))
        .sort(sortScenes ?? ((a, b) => (a.name || '').localeCompare(b.name || ''))),
    [scenes, matchesScene, sortScenes],
  );

  const handleScenePress = useCallback(
    (scene: SceneSelect) => {
      navigateToDetail('Scene', scene.id);
    },
    [navigateToDetail],
  );

  return (
    <GenericRelationDisplay<SceneSelect, SceneSelect>
      relations={relatedScenes}
      getRelatedItem={(sceneId) => scenes.find((scene) => scene.id === sceneId)}
      getRelationItemId={(scene) => scene.id}
      getItemDisplayName={(scene) => scene.name}
      noItemsMessage={noItemsMessage}
      renderItemExtraContent={(scene, relatedScene) => (
        <View>
          <Text style={{ fontSize: 16, fontWeight: '600', color: colors.text }}>
            {relatedScene.name}
          </Text>
          {getDetails?.(scene).map((detail) => (
            <RelationAttributeLine key={detail.label} label={detail.label} value={detail.value} />
          ))}
        </View>
      )}
      title={title}
      onItemPress={handleScenePress}
    />
  );
};

export default RelatedScenesList;
