import { type PageFormat, pageFormatFor } from '@keres/shared';
import { useEffect, useState } from 'react';
import { useDrizzle } from '@/src/db';
import type { SceneSelect } from '@/src/db/schema';
import { createChapterService } from '@/src/services/storymanagement/ChapterService';
import { createStoryArcService } from '@/src/services/storymanagement/StoryArcService';
import { useStoryStore } from '@/src/state/storyStore';

/**
 * The shape a page of the scene's work is drawn in: the work's own choice or its medium's. A scene
 * belongs to the work of its chapter; one filed in no chapter takes the work in effect. `null` while loading.
 */
export function useSceneArcPageFormat(scene: Pick<SceneSelect, 'chapterId'>): PageFormat | null {
  const db = useDrizzle();
  const effectiveArcId = useStoryStore((state) => state.effectiveArc?.id);
  const [format, setFormat] = useState<PageFormat | null>(null);

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const chapter = scene.chapterId
          ? await createChapterService(db).getById(scene.chapterId)
          : undefined;
        const arcId = chapter?.arcId ?? effectiveArcId;
        const arc = arcId ? await createStoryArcService(db).getById(arcId) : undefined;
        if (alive) setFormat(pageFormatFor(arc?.medium ?? 'generic', arc?.pageFormat));
      } catch {
        if (alive) setFormat(null);
      }
    })();
    return () => {
      alive = false;
    };
  }, [db, scene.chapterId, effectiveArcId]);

  return format;
}
