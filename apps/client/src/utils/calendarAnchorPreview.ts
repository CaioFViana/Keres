import {
  calendarSecondsPerDay,
  calendarUnitDays,
  dayNumberForElapsed,
  formatCalendarDate,
  SCENE_POSITION_FRACTION,
  type CalendarDefinitionType,
  type ScenePosition,
} from '@keres/shared';
import { buildStoryTimelineLayout } from '@keres/shared/graphs/storyTimelineLayout';
import type { ChapterAnchorSelect, ChapterSelect, SceneSelect, StorySelect } from '@/src/db/schema';

export type CalendarAnchorPreviewKind = 'story-start' | 'anchor-start' | 'anchor-end';

export interface CalendarAnchorPreviewRow {
  id: string;
  kind: CalendarAnchorPreviewKind;
  containerId: string | null;
  containerName: string | null;
  containerType: 'chapter' | 'event' | null;
  sceneId: string | null;
  sceneName: string | null;
  position: ScenePosition | null;
  /** Null means the story has not declared its first absolute date yet. */
  date: string | null;
}

interface Inputs {
  story: Pick<StorySelect, 'timelineEpochDay' | 'timelineEpochSeconds'>;
  chapters: ChapterSelect[];
  scenes: SceneSelect[];
  anchors: ChapterAnchorSelect[];
  definition: CalendarDefinitionType;
}

const timeLabel = (definition: CalendarDefinitionType, seconds: number) => {
  const perDay = calendarSecondsPerDay(definition);
  const withinDay = ((Math.floor(seconds) % perDay) + perDay) % perDay;
  const hour = Math.floor(withinDay / (definition.minutesPerHour * definition.secondsPerMinute));
  const minute = Math.floor(
    (withinDay % (definition.minutesPerHour * definition.secondsPerMinute)) /
      definition.secondsPerMinute,
  );
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
};

/**
 * Reads anchors through the same relative timeline arithmetic as the Timeline surface.
 *
 * A calendar never owns those values: it only formats the underlying story-time position. This
 * makes the edit preview and the inspection sheet report the exact same consequence of a calendar
 * definition change, without turning a calendar date into a second persistence model.
 */
export function buildCalendarAnchorPreview({
  story,
  chapters,
  scenes,
  anchors,
  definition,
}: Inputs): CalendarAnchorPreviewRow[] {
  const activeChapters = chapters
    .filter((chapter) => !chapter.isDeleted && chapter.type === 'chapter')
    .sort((left, right) => left.index - right.index);
  const chapterById = new Map(
    chapters.filter((chapter) => !chapter.isDeleted).map((chapter) => [chapter.id, chapter]),
  );
  const chapterIndex = new Map(activeChapters.map((chapter) => [chapter.id, chapter.index]));
  let previousChapterIndex: number | undefined;
  const spineScenes = scenes
    .filter(
      (scene): scene is SceneSelect & { chapterId: string } =>
        !scene.isDeleted && Boolean(scene.chapterId && chapterIndex.has(scene.chapterId)),
    )
    .sort(
      (left, right) =>
        (chapterIndex.get(left.chapterId) ?? 0) - (chapterIndex.get(right.chapterId) ?? 0) ||
        left.index - right.index,
    )
    .map((scene) => {
      const currentChapterIndex = chapterIndex.get(scene.chapterId);
      const hideGapBefore =
        previousChapterIndex !== undefined &&
        currentChapterIndex !== previousChapterIndex &&
        currentChapterIndex !== previousChapterIndex + 1;
      previousChapterIndex = currentChapterIndex;
      return {
        ...scene,
        hideGapBefore,
        chapterName: chapterById.get(scene.chapterId)?.name ?? '',
        chapterColor: '',
      };
    });
  const layout = buildStoryTimelineLayout(spineScenes, { calendar: definition });
  const rowByScene = new Map(layout.rows.map((row) => [row.id, row]));
  const sceneById = new Map(
    scenes.filter((scene) => !scene.isDeleted).map((scene) => [scene.id, scene]),
  );
  const units = calendarUnitDays(definition);
  const secondsPerDay = calendarSecondsPerDay(definition);
  const asDate = (elapsedSeconds: number) => {
    if (story.timelineEpochDay === null || story.timelineEpochDay === undefined) return null;
    const epochSeconds = story.timelineEpochSeconds ?? 0;
    return `${formatCalendarDate(
      definition,
      dayNumberForElapsed(definition, story.timelineEpochDay, elapsedSeconds, epochSeconds),
    )} · ${timeLabel(definition, epochSeconds + elapsedSeconds)}`;
  };
  const pointDate = (
    sceneId: string,
    position: ScenePosition,
    offset: number | null,
    offsetUnit: string | null,
  ) => {
    const row = rowByScene.get(sceneId);
    if (row?.elapsedSeconds === undefined) return null;
    const durationSeconds = row.duration
      ? row.duration.value * ((units[row.duration.unit as keyof typeof units] ?? 0) * secondsPerDay)
      : 0;
    const offsetSeconds =
      offset && offsetUnit
        ? offset * ((units[offsetUnit as keyof typeof units] ?? 0) * secondsPerDay)
        : 0;
    return asDate(
      row.elapsedSeconds +
        durationSeconds * (SCENE_POSITION_FRACTION[position] ?? 0) +
        offsetSeconds,
    );
  };

  const rows: CalendarAnchorPreviewRow[] = [];
  if (story.timelineEpochDay !== null && story.timelineEpochDay !== undefined) {
    rows.push({
      id: 'story-start',
      kind: 'story-start',
      containerId: null,
      containerName: null,
      containerType: null,
      sceneId: null,
      sceneName: null,
      position: null,
      date: asDate(0),
    });
  }
  for (const anchor of anchors.filter((candidate) => !candidate.isDeleted)) {
    const container = chapterById.get(anchor.chapterId);
    const startScene = sceneById.get(anchor.startSceneId);
    rows.push({
      id: `${anchor.id}:start`,
      kind: 'anchor-start',
      containerId: container?.id ?? null,
      containerName: container?.name ?? null,
      containerType: container?.type === 'event' ? 'event' : 'chapter',
      sceneId: startScene?.id ?? null,
      sceneName: startScene?.name ?? null,
      position: anchor.startPosition,
      date: pointDate(
        anchor.startSceneId,
        anchor.startPosition,
        anchor.startOffset,
        anchor.startOffsetUnit,
      ),
    });
    if (anchor.endSceneId && anchor.endPosition) {
      const endScene = sceneById.get(anchor.endSceneId);
      rows.push({
        id: `${anchor.id}:end`,
        kind: 'anchor-end',
        containerId: container?.id ?? null,
        containerName: container?.name ?? null,
        containerType: container?.type === 'event' ? 'event' : 'chapter',
        sceneId: endScene?.id ?? null,
        sceneName: endScene?.name ?? null,
        position: anchor.endPosition,
        date: pointDate(
          anchor.endSceneId,
          anchor.endPosition,
          anchor.endOffset,
          anchor.endOffsetUnit,
        ),
      });
    }
  }
  return rows;
}
