import React from 'react';
import { useTranslation } from 'react-i18next';
import DetailField from '@/src/components/common/display/DetailField/DetailField';
import type { SceneSelect } from '@/src/db/schema';
import { useSceneArcMedium } from '@/src/hooks/useSceneArcMedium';
import { useSceneMusic } from '@/src/hooks/useSceneMusic';
import { sceneMusicWordKey } from '@/src/utils/sceneMusicWords';

interface SceneMusicEntryProps {
  scene: Pick<SceneSelect, 'id' | 'storyId' | 'chapterId'>;
  onOpen: () => void;
}

/**
 * The way into a scene's music from its detail screen. It is offered in every kind of work - a novel
 * has the song sung in a tavern as much as a comic has its soundtrack - and only the word changes.
 */
const SceneMusicEntry: React.FC<SceneMusicEntryProps> = ({ scene, onOpen }) => {
  const { t } = useTranslation();
  const medium = useSceneArcMedium(scene);
  const { views } = useSceneMusic(scene.id, scene.storyId);
  return (
    <DetailField
      label={t(sceneMusicWordKey(medium))}
      value={
        views.length === 0
          ? t('scene_music_empty_short')
          : t('scene_music_count', { count: views.length })
      }
      onPress={onOpen}
    />
  );
};

export default SceneMusicEntry;
