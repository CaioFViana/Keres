import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDrizzle } from '@/src/db';
import type { ChapterAnchorSelect, ChapterSelect, SceneSelect } from '@/src/db/schema';
import { createChapterAnchorService } from '@/src/services/storymanagement/ChapterAnchorService';
import { createChapterService } from '@/src/services/storymanagement/ChapterService';
import { createSceneService } from '@/src/services/storymanagement/SceneService';
import { useNotificationStore } from '@/src/state/notificationStore';
import { useStoryStore } from '@/src/state/storyStore';
import { useTheme } from '@/src/theme';
import {
  formatChapterUniverseDuration,
  formatSceneGap,
  formatSceneUniverseDuration,
} from '@/src/utils/sceneTiming';
import { buildStoryTimelineFileName, deliverSvgMap } from '@/src/utils/storyTransfer';
import { buildChapterColors } from '@keres/shared/graphs/storyGraphLayout';
import type {
  StoryTimelineEventPlacement,
  StoryTimelineScaleMode,
  TimelineAnchoredContainer,
} from '@keres/shared/graphs/storyTimelineLayout';
import { buildStoryTimelineLayout } from '@keres/shared/graphs/storyTimelineLayout';
import { renderStoryTimelineSvg } from '@keres/shared/graphs/storyTimelineSvg';

/**
 * The timeline's data and the drawing derived from it.
 *
 * The screen keeps the chrome (filters, sheets, zoom). Everything that turns chapters, events and
 * anchors into a layout lives here, so adding a toggle does not grow the screen past the size
 * ceiling.
 */
export function useStoryTimeline() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const db = useDrizzle();
  const story = useStoryStore((state) => state.selectedStory);
  const notify = useNotificationStore((state) => state.showNotification);
  const [chapters, setChapters] = useState<ChapterSelect[]>([]);
  const [scenes, setScenes] = useState<SceneSelect[]>([]);
  const [chapterIds, setChapterIds] = useState<string[]>([]);
  const [scaleMode, setScaleMode] = useState<StoryTimelineScaleMode>('compact');
  const [eventPlacement, setEventPlacement] = useState<StoryTimelineEventPlacement>('overlay');
  const [showSceneNames, setShowSceneNames] = useState(false);
  const [events, setEvents] = useState<ChapterSelect[]>([]);
  const [anchors, setAnchors] = useState<ChapterAnchorSelect[]>([]);
  const [showEvents, setShowEvents] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!story) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [loadedChapters, loadedEvents, loadedScenes, loadedAnchors] = await Promise.all([
          /*
           * Chapters and events are fetched apart, and the axis is still built from chapters alone.
           * The two have independent numberings, so interleaving them into one spine would be
           * meaningless. Events reach the drawing the other way round: as bands placed by their
           * anchors, above the scenes rather than among them.
           */
          createChapterService(db).getAllByStoryId(story.id, 'chapter'),
          createChapterService(db).getAllByStoryId(story.id, 'event'),
          createSceneService(db).getAllByStoryId(story.id),
          createChapterAnchorService(db).getAnchorsForStory(story.id),
        ]);
        if (cancelled) return;
        setEvents(loadedEvents.filter((event) => !event.isDeleted));
        setAnchors(loadedAnchors);
        const visibleChapters = loadedChapters
          .filter((chapter) => !chapter.isDeleted)
          .sort((a, b) => a.index - b.index);
        setChapters(visibleChapters);
        setScenes(loadedScenes.filter((scene) => !scene.isDeleted));
        setChapterIds(visibleChapters.map((chapter) => chapter.id));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [db, story]);

  const orderedScenes = useMemo(() => {
    const chapterById = new Map(chapters.map((chapter) => [chapter.id, chapter]));
    const colorsByChapter = buildChapterColors(chapters);
    let previousChapterIndex: number | undefined;
    return scenes
      .filter((scene) => chapterIds.includes(scene.chapterId))
      .sort(
        (a, b) =>
          (chapterById.get(a.chapterId)?.index ?? 0) - (chapterById.get(b.chapterId)?.index ?? 0) ||
          a.index - b.index,
      )
      .map((scene) => {
        const chapterIndex = chapterById.get(scene.chapterId)?.index;
        const hideGapBefore =
          previousChapterIndex !== undefined &&
          chapterIndex !== previousChapterIndex &&
          chapterIndex !== previousChapterIndex + 1;
        previousChapterIndex = chapterIndex;
        return {
          ...scene,
          hideGapBefore,
          chapterName: chapterById.get(scene.chapterId)?.name ?? t('common_na'),
          chapterColor: colorsByChapter.get(scene.chapterId) ?? colors.border,
          gapLabel: formatSceneGap(scene, t),
          durationLabel: formatSceneUniverseDuration(scene, t),
        };
      });
  }, [chapterIds, chapters, colors.border, scenes, t]);
  const chapterDurationLabels = useMemo(
    () =>
      new Map(
        chapters.map((chapter) => [
          chapter.id,
          formatChapterUniverseDuration(
            orderedScenes.filter((scene) => scene.chapterId === chapter.id),
            t,
          ),
        ]),
      ),
    [chapters, orderedScenes, t],
  );
  const storyDurationLabel = useMemo(
    () => formatChapterUniverseDuration(orderedScenes, t),
    [orderedScenes, t],
  );
  const timelineScenes = useMemo(
    () =>
      orderedScenes.map((scene) => ({
        ...scene,
        chapterDurationLabel: chapterDurationLabels.get(scene.chapterId),
      })),
    [chapterDurationLabels, orderedScenes],
  );
  /*
   * The anchored containers, in the order the writer would look for them.
   *
   * Both kinds can be anchored: an event because it has no chapter number at all, and a chapter
   * because a flashback happens at a different time from when it is told. A container with no
   * anchor is simply not here - it has made no claim about when it happens.
   */
  const anchoredContainers = useMemo<TimelineAnchoredContainer[]>(() => {
    if (!showEvents) return [];
    const containers = [...events, ...chapters];
    const colorsByChapter = buildChapterColors(chapters);
    const eventColors = buildChapterColors(events);
    return containers.flatMap((container) => {
      const stretches = anchors
        .filter((anchor) => anchor.chapterId === container.id)
        .sort((a, b) => a.order - b.order)
        .map((anchor) => ({
          start: {
            sceneId: anchor.startSceneId,
            position: anchor.startPosition,
            offset: anchor.startOffset,
            offsetUnit: anchor.startOffsetUnit,
          },
          end:
            anchor.endSceneId && anchor.endPosition
              ? {
                  sceneId: anchor.endSceneId,
                  position: anchor.endPosition,
                  offset: anchor.endOffset,
                  offsetUnit: anchor.endOffsetUnit,
                }
              : null,
        }));
      if (stretches.length === 0) return [];
      const isEvent = container.type === 'event';
      const contained = scenes
        .filter((scene) => scene.chapterId === container.id)
        .sort((a, b) => a.index - b.index)
        .map((scene) => ({
          id: scene.id,
          name: scene.name,
          index: scene.index,
          summary: scene.summary,
          gap: scene.gap,
          gapType: scene.gapType,
          gapLabel: formatSceneGap(scene, t),
          duration: scene.duration,
          durationType: scene.durationType,
          durationLabel: formatSceneUniverseDuration(scene, t),
        }));
      return [
        {
          id: container.id,
          name: container.name,
          color:
            (isEvent ? eventColors : colorsByChapter).get(container.id) ?? colors.textSecondary,
          isEvent,
          stretches,
          scenes: contained,
        },
      ];
    });
  }, [anchors, chapters, colors.textSecondary, events, scenes, showEvents, t]);
  const layout = useMemo(
    () => buildStoryTimelineLayout(timelineScenes, scaleMode, anchoredContainers, eventPlacement),
    [anchoredContainers, eventPlacement, scaleMode, timelineScenes],
  );

  const exportTimeline = useCallback(async () => {
    if (!story || !layout.rows.length) return;
    setSaving(true);
    try {
      const svg = renderStoryTimelineSvg(layout, {
        title: story.title,
        subtitle: t('story_timeline_subtitle', { count: layout.rows.length }),
        labels: {
          gap: t('story_timeline_gap'),
          duration: t('story_timeline_duration'),
          compressed:
            scaleMode === 'compact'
              ? t('story_timeline_compressed')
              : t('story_timeline_proportional_legend'),
          unanchored: t('story_timeline_unanchored'),
        },
        showSceneNames,
        storyDuration: { title: t('story_timeline_story_duration'), value: storyDurationLabel },
        colors: {
          background: colors.background,
          surface: colors.surface,
          text: colors.text,
          textSecondary: colors.textSecondary,
          border: colors.border,
        },
      });
      const result = await deliverSvgMap(svg, buildStoryTimelineFileName(story.title));
      notify(
        result.delivered
          ? t('story_timeline_export_success', { fileName: result.fileName })
          : t('story_timeline_export_no_share_target', { path: result.uri || result.fileName }),
        result.delivered ? 'success' : 'warning',
      );
    } catch (error) {
      console.log('StoryTimelineScreen: failed to export timeline.', error);
      notify(t('story_timeline_export_failed'), 'error');
    } finally {
      setSaving(false);
    }
  }, [colors, layout, notify, scaleMode, showSceneNames, story, storyDurationLabel, t]);

  return {
    story,
    loading,
    saving,
    chapters,
    scenes,
    events,
    anchors,
    chapterIds,
    setChapterIds,
    scaleMode,
    setScaleMode,
    eventPlacement,
    setEventPlacement,
    showEvents,
    setShowEvents,
    showSceneNames,
    setShowSceneNames,
    layout,
    storyDurationLabel,
    exportTimeline,
  };
}
