import React from 'react';
import { useTranslation } from 'react-i18next';
import DetailField from '@/src/components/common/display/DetailField/DetailField';
import type { SceneSelect } from '@/src/db/schema';
import { useSceneArcMedium } from '@/src/hooks/useSceneArcMedium';
import { useSceneMusicCount } from '@/src/hooks/useSceneMusic';
import { sceneMusicWordKey } from '@/src/utils/sceneMusicWords';

interface SceneMusicEntryProps {
  scene: Pick<SceneSelect, 'id' | 'storyId' | 'chapterId'>;
  onOpen: () => void;
}

/**
 * The way into a scene's music from its detail screen. It is offered in every kind of work - a novel
 * has the song sung in a tavern as much as a comic has its soundtrack - and only the word changes.
 * It asks for the count of the scene's music and nothing more: no song and no Gallery row is read.
 */
const SceneMusicEntry: React.FC<SceneMusicEntryProps> = ({ scene, onOpen }) => {
  const { t } = useTranslation();
  const medium = useSceneArcMedium(scene);
  const count = useSceneMusicCount(scene.id, scene.storyId);
  return (
    <DetailField
      label={t(sceneMusicWordKey(medium))}
      value={count === 0 ? t('scene_music_empty_short') : t('scene_music_count', { count })}
      onPress={onOpen}
    />
  );
};

export default SceneMusicEntry;
