import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { SceneSelect } from '../../db/schema';
import GenericRelationDisplay from '../RelationManager/GenericRelationDisplay';

interface ChapterSceneManagerProps {
  allScenes: SceneSelect[]; // All scenes in the story
  currentChapterId: string;
}

const ChapterSceneManager: React.FC<ChapterSceneManagerProps> = ({
  allScenes,
  currentChapterId,
}) => {
  const { t } = useTranslation();

  const scenesForChapter = useMemo(() => {
    return allScenes.filter(scene => scene.chapterId === currentChapterId && !scene.isDeleted);
  }, [allScenes, currentChapterId]);

  const getSceneById = (sceneId: string) => allScenes.find(scene => scene.id === sceneId);
  const getSceneId = (scene: SceneSelect) => scene.id;
  const getSceneDisplayName = (scene: SceneSelect) => scene.name;

  return (
    <GenericRelationDisplay<SceneSelect, SceneSelect>
      relations={scenesForChapter}
      getRelatedItem={getSceneById}
      getRelationItemId={getSceneId}
      getItemDisplayName={getSceneDisplayName}
      noItemsMessage={'no_scenes_in_chapter'}
      title={t('scenes_title')}
    />
  );
};

export default ChapterSceneManager;
