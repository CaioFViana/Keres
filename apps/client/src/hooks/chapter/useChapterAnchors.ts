import { useCallback, useMemo } from 'react';
import { useDrizzle } from '@/src/db';
import type { ChapterAnchorSelect } from '@/src/db/schema';
import { useLoadedResource } from '@/src/hooks/lists/useLoadedResource';
import { createChapterAnchorService } from '@/src/services/storymanagement/scenes-chapters/ChapterAnchorService';
import { createChapterService } from '@/src/services/storymanagement/scenes-chapters/ChapterService';
import { createSceneService } from '@/src/services/storymanagement/scenes-chapters/SceneService';
import { useStoryStore } from '@/src/state/story/storyStore';

export type ChapterAnchorRow = ChapterAnchorSelect;

const NOTHING_LOADED: {
  anchors: ChapterAnchorRow[];
  scenes: AnchorSceneChoice[];
  hasContents: boolean;
} = { anchors: [], scenes: [], hasContents: false };

/** A scene a stretch may be pinned to, named the way the writer will recognise it. */
export interface AnchorSceneChoice {
  id: string;
  label: string;
}

/** The values one stretch is stated with. Both scene ids are absent until the writer picks them. */
export interface ChapterAnchorInput {
  startSceneId: string | null;
  startPosition: 'start' | 'middle' | 'end';
  startOffset: number | null;
  startOffsetUnit: string | null;
  endSceneId: string | null;
  endPosition: 'start' | 'middle' | 'end' | null;
  endOffset: number | null;
  endOffsetUnit: string | null;
}

/**
 * A container's placement on the story's timeline, loaded and saved.
 *
 * The scene list is the part worth explaining: only the spine's scenes are offered. Anchoring an
 * event to another event's scene would measure it against something that has no position of its
 * own, and the drawing would have nothing to resolve it against.
 */
export function useChapterAnchors(
  storyId: string,
  chapterId: string,
  currentUserId: string | null,
) {
  const db = useDrizzle();
  const storyType = useStoryStore((state) => state.selectedStory?.type);
  const load = useMemo(
    () => async () => {
      const [anchors, loadedScenes, containers] = await Promise.all([
        createChapterAnchorService(db).getAnchorsForChapter(chapterId),
        createSceneService(db).getAllByStoryId(storyId),
        createChapterService(db).getAllByStoryId(storyId, 'chapter'),
      ]);
      const hasContents = loadedScenes.some(
        (scene) => !scene.isDeleted && scene.chapterId === chapterId,
      );

      const byId = new Map(containers.filter((one) => !one.isDeleted).map((one) => [one.id, one]));
      const scenes: AnchorSceneChoice[] = loadedScenes
        .filter(
          (scene): scene is typeof scene & { chapterId: string } =>
            !scene.isDeleted && Boolean(scene.chapterId && byId.has(scene.chapterId)),
        )
        .sort(
          (a, b) =>
            (byId.get(a.chapterId)?.index ?? 0) - (byId.get(b.chapterId)?.index ?? 0) ||
            a.index - b.index,
        )
        .map((scene) => {
          const chapter = byId.get(scene.chapterId);
          const chapterLabel =
            storyType === 'linear' && chapter
              ? `${chapter.index}. ${chapter.name}`
              : (chapter?.name ?? '');
          const sceneLabel = storyType === 'linear' ? `${scene.index}. ${scene.name}` : scene.name;
          return { id: scene.id, label: `${chapterLabel} · ${sceneLabel}` };
        });
      return { anchors, scenes, hasContents };
    },
    [chapterId, db, storyId, storyType],
  );
  const {
    data: { anchors, scenes, hasContents },
    reload,
  } = useLoadedResource({ load, initial: NOTHING_LOADED, label: 'chapter anchors' });

  const save = useCallback(
    async (input: ChapterAnchorInput, anchorId: string | null) => {
      if (!currentUserId || !input.startSceneId) return;
      const service = createChapterAnchorService(db);
      const values = {
        startSceneId: input.startSceneId,
        startPosition: input.startPosition,
        startOffset: input.startOffset,
        startOffsetUnit: input.startOffsetUnit,
        endSceneId: input.endSceneId,
        endPosition: input.endPosition,
        endOffset: input.endOffset,
        endOffsetUnit: input.endOffsetUnit,
      };
      if (anchorId) await service.updateAnchor(currentUserId, anchorId, values);
      else
        await service.createAnchor(currentUserId, {
          storyId,
          chapterId,
          order: await service.nextOrderFor(storyId, chapterId),
          ...values,
        });
      await reload();
    },
    [chapterId, currentUserId, db, reload, storyId],
  );

  const remove = useCallback(
    async (anchorId: string) => {
      if (!currentUserId) return;
      await createChapterAnchorService(db).deleteAnchor(currentUserId, anchorId);
      await reload();
    },
    [currentUserId, db, reload],
  );

  const sceneNames = useMemo(
    () => new Map(scenes.map((scene) => [scene.id, scene.label])),
    [scenes],
  );

  return { anchors, scenes, sceneNames, hasContents, save, remove, reload };
}
