import React from 'react';
import { useTranslation } from 'react-i18next';
import DetailField from '@/src/components/common/display/DetailField/DetailField';
import type { SceneSelect } from '@/src/db/schema';
import { useSceneArcMedium } from '@/src/hooks/useSceneArcMedium';
import { useScenePages } from '@/src/hooks/useScenePages';

interface ScenePagesEntryProps {
  scene: Pick<SceneSelect, 'id' | 'storyId' | 'chapterId'>;
  onOpen: () => void;
}

/**
 * The way into a scene's pages from its detail screen. Offered in a comic or a storyboard, and in any
 * scene that already has pages whatever its work's medium - pages are never hidden once they exist.
 */
const ScenePagesEntry: React.FC<ScenePagesEntryProps> = ({ scene, onOpen }) => {
  const { t } = useTranslation();
  const medium = useSceneArcMedium(scene);
  const { pages } = useScenePages(scene.id, scene.storyId);
  const isVisualMedium = medium === 'comic' || medium === 'storyboard';
  if (!isVisualMedium && pages.length === 0) return null;
  const kind = medium === 'storyboard' ? 'frame' : 'page';
  return (
    <DetailField
      label={t(kind === 'frame' ? 'scene_frames' : 'scene_pages')}
      value={
        pages.length === 0
          ? t(`scene_pages_empty_short_${kind}`)
          : t(`scene_pages_count_${kind}`, { count: pages.length })
      }
      onPress={onOpen}
    />
  );
};

export default ScenePagesEntry;
