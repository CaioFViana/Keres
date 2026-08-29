import type { CalendarDefinitionType } from '@keres/shared';
import {
  calendarSecondsPerDay,
  calendarUnitDays,
  dayNumberForElapsed,
  formatCalendarDate,
} from '@keres/shared';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useDrizzle } from '@/src/db';
import type { ChapterSelect, SceneSelect } from '@/src/db/schema';
import { createChapterService } from '@/src/services/storymanagement/ChapterService';
import { createSceneService } from '@/src/services/storymanagement/SceneService';
import { useStoryStore } from '@/src/state/storyStore';
import { entityEventEmitter } from '@/src/utils/EventEmitter';
import { useEntityInitialLoad } from './useEntityRefreshLifecycle';
import { useStoryCalendar } from './useStoryCalendar';

type TimedScene = Pick<
  SceneSelect,
  'id' | 'chapterId' | 'index' | 'gap' | 'gapType' | 'duration' | 'durationType' | 'isDeleted'
>;

const secondsFor = (
  value: number | null | undefined,
  unit: string | null | undefined,
  calendar: CalendarDefinitionType,
) => {
  if (!value || !unit) return 0;
  const days = calendarUnitDays(calendar)[unit as keyof ReturnType<typeof calendarUnitDays>];
  return typeof days === 'number' ? value * days * calendarSecondsPerDay(calendar) : 0;
};

const formatTime = (definition: CalendarDefinitionType, elapsedSeconds: number) => {
  const secondsPerDay = calendarSecondsPerDay(definition);
  const withinDay = ((Math.floor(elapsedSeconds) % secondsPerDay) + secondsPerDay) % secondsPerDay;
  const hour = Math.floor(withinDay / (definition.minutesPerHour * definition.secondsPerMinute));
  const minute = Math.floor((withinDay % (definition.minutesPerHour * definition.secondsPerMinute)) / definition.secondsPerMinute);
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
};

/**
 * The canonical date of every scene on the narrative spine.
 *
 * Dates are derived from the same ordered gaps and durations as the story timeline. A detail
 * screen therefore does not guess from its immediate neighbours, which would be wrong after a
 * chapter boundary or a skipped chapter.
 */
export function useSceneCalendarDates(storyId?: string | null) {
  const db = useDrizzle();
  const story = useStoryStore((state) => state.selectedStory);
  const { definition } = useStoryCalendar(storyId ?? undefined);
  const [scenes, setScenes] = useState<SceneSelect[]>([]);
  const [chapters, setChapters] = useState<ChapterSelect[]>([]);

  const reload = useCallback(async () => {
    if (!db || !storyId) {
      setScenes([]);
      setChapters([]);
      return;
    }
    const [loadedScenes, loadedChapters] = await Promise.all([
      createSceneService(db).getAllByStoryId(storyId),
      createChapterService(db).getAllByStoryId(storyId),
    ]);
    setScenes(loadedScenes);
    setChapters(loadedChapters);
  }, [db, storyId]);

  useEntityInitialLoad(reload);

  useEffect(() => {
    const listener = (changedStoryId?: string) => {
      if (!changedStoryId || changedStoryId === storyId) void reload();
    };
    entityEventEmitter.on('scene_changed', listener);
    entityEventEmitter.on('chapter_changed', listener);
    return () => {
      entityEventEmitter.off('scene_changed', listener);
      entityEventEmitter.off('chapter_changed', listener);
    };
  }, [reload, storyId]);

  const starts = useMemo(() => {
    if (!definition) return { scene: new Map<string, number>(), gap: new Map<string, number>() };
    const chapterIndex = new Map(
      chapters
        .filter((chapter) => !chapter.isDeleted)
        .map((chapter) => [chapter.id, chapter.index]),
    );
    const ordered = (scenes as TimedScene[])
      .filter((scene) => !scene.isDeleted && scene.chapterId && chapterIndex.has(scene.chapterId))
      .sort((a, b) =>
        (chapterIndex.get(a.chapterId!) ?? 0) - (chapterIndex.get(b.chapterId!) ?? 0) ||
        a.index - b.index,
      );
    let elapsed = 0;
    let previousChapterIndex: number | undefined;
    const sceneStarts = new Map<string, number>();
    const gapStarts = new Map<string, number>();
    for (const scene of ordered) {
      const currentChapterIndex = chapterIndex.get(scene.chapterId!)!;
      const hideGap =
        previousChapterIndex !== undefined &&
        currentChapterIndex !== previousChapterIndex &&
        currentChapterIndex !== previousChapterIndex + 1;
      if (previousChapterIndex !== undefined && !hideGap) {
        gapStarts.set(scene.id, elapsed);
        elapsed += secondsFor(scene.gap, scene.gapType, definition);
      }
      sceneStarts.set(scene.id, elapsed);
      elapsed += secondsFor(scene.duration, scene.durationType, definition);
      previousChapterIndex = currentChapterIndex;
    }
    return { scene: sceneStarts, gap: gapStarts };
  }, [chapters, definition, scenes]);

  const dateForScene = useCallback(
    (scene: Pick<TimedScene, 'id' | 'duration' | 'durationType'>) => {
      const epochDay = story?.timelineEpochDay;
      const epochSeconds = story?.timelineEpochSeconds ?? 0;
      const startSeconds = starts.scene.get(scene.id);
      if (!definition || epochDay === null || epochDay === undefined || startSeconds === undefined) {
        return null;
      }
      const endSeconds = startSeconds + secondsFor(scene.duration, scene.durationType, definition);
      const startDay = dayNumberForElapsed(definition, epochDay, startSeconds, epochSeconds);
      const endDay = dayNumberForElapsed(definition, epochDay, endSeconds, epochSeconds);
      const date = formatCalendarDate(definition, startDay);
      const startTime = formatTime(definition, epochSeconds + startSeconds);
      const endTime = formatTime(definition, epochSeconds + endSeconds);
      const gapStartSeconds = starts.gap.get(scene.id);
      const gapStartDay =
        gapStartSeconds === undefined
          ? undefined
          : dayNumberForElapsed(definition, epochDay, gapStartSeconds, epochSeconds);
      const gapStartTime =
        gapStartSeconds === undefined ? undefined : formatTime(definition, epochSeconds + gapStartSeconds);
      return {
        date: startTime === '00:00' ? date : `${date} · ${startTime}`,
        // The date is already shown at the start. Repeat it only when an interval crosses a day.
        durationEnd:
          endSeconds === startSeconds
            ? null
            : startDay === endDay
              ? `${startTime} → ${endTime}`
              : `→ ${formatCalendarDate(definition, endDay)} · ${endTime}`,
        gapRange:
          gapStartSeconds === undefined || gapStartSeconds === startSeconds
            ? null
            : gapStartDay === startDay
              ? `${gapStartTime} → ${startTime}`
              : `${formatCalendarDate(definition, gapStartDay!)} · ${gapStartTime} → ${startTime}`,
      };
    },
    [definition, starts, story?.timelineEpochDay, story?.timelineEpochSeconds],
  );

  return { dateForScene };
}
