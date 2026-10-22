import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useState } from 'react';
import { useDrizzle } from '@/src/db';
import { createChapterService } from '@/src/services/storymanagement/scenes-chapters/ChapterService';
import { createSceneService } from '@/src/services/storymanagement/scenes-chapters/SceneService';
import { logger } from '@/src/utils/logging/logger';

export interface ResumeScene {
  id: string;
  name: string;
  chapterName: string | null;
  editedAt: Date;
}

/**
 * The scene the story was last written in, read again each time the screen comes into focus so that
 * coming back from the editor shows the scene just left. `null` while there is none to offer.
 */
export function useResumeScene(storyId: string | undefined): ResumeScene | null {
  const db = useDrizzle();
  const [resume, setResume] = useState<{ storyId: string; scene: ResumeScene | null } | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (!storyId || !db) return;
      let cancelled = false;
      void (async () => {
        try {
          const scene = await createSceneService(db).getLastEdited(storyId);
          const chapter = scene?.chapterId
            ? await createChapterService(db).getById(scene.chapterId)
            : undefined;
          if (cancelled) return;
          setResume({
            storyId,
            scene: scene
              ? {
                  id: scene.id,
                  name: scene.name,
                  chapterName: chapter?.name ?? null,
                  editedAt: scene.updatedAt,
                }
              : null,
          });
        } catch (error) {
          logger.error('Could not read the last edited scene:', error);
          if (!cancelled) setResume({ storyId, scene: null });
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [db, storyId]),
  );

  // Another story's answer is no answer for this one.
  return resume && resume.storyId === storyId ? resume.scene : null;
}
