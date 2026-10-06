import { useEffect, useState } from 'react';
import { useDrizzle } from '@/src/db';
import type { SceneSelect } from '@/src/db/schema';
import { createChapterService } from '@/src/services/storymanagement/ChapterService';
import { createStoryArcService } from '@/src/services/storymanagement/StoryArcService';
import { useStoryStore } from '@/src/state/storyStore';

/**
 * The medium of the work a scene belongs to, or `null` while loading. A scene belongs to the work of
 * its chapter; one filed in no chapter takes the work in effect.
 */
export function useSceneArcMedium(scene: Pick<SceneSelect, 'chapterId'>): string | null {
  const db = useDrizzle();
  const effectiveArc = useStoryStore((state) => state.effectiveArc);
  const [medium, setMedium] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const chapter = scene.chapterId
          ? await createChapterService(db).getById(scene.chapterId)
          : undefined;
        // The arc's medium rides on its row; the store knows the one in effect, which is enough for
        // a scene with no chapter, and the chapter's arc is read from the arcs when it has one.
        if (chapter?.arcId) {
          const arc = await createStoryArcService(db).getById(chapter.arcId);
          if (alive) setMedium(arc?.medium ?? null);
        } else if (alive) {
          setMedium(effectiveArc?.medium ?? null);
        }
      } catch {
        if (alive) setMedium(null);
      }
    })();
    return () => {
      alive = false;
    };
  }, [db, scene.chapterId, effectiveArc?.medium]);

  return medium;
}
