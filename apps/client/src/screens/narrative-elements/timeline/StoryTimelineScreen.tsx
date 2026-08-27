import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import MultiSelectPill from '@/src/components/common/inputs/MultiSelectPill/MultiSelectPill';
import GraphNodeSheet from '@/src/components/features/graphs/GraphNodeSheet/GraphNodeSheet';
import type { ChapterSelect, SceneSelect } from '@/src/db/schema';
import { useDrizzle } from '@/src/db';
import type { ChapterAnchorSelect } from '@/src/db/schema';
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
import { buildChapterColors } from '@keres/shared/graphs/storyGraphLayout';
import { buildStoryTimelineFileName, deliverSvgMap } from '@/src/utils/storyTransfer';
import type {
  StoryTimelineScaleMode,
  TimelineAnchoredContainer,
} from '@keres/shared/graphs/storyTimelineLayout';
import { buildStoryTimelineLayout } from '@keres/shared/graphs/storyTimelineLayout';
import { renderStoryTimelineSvg } from '@keres/shared/graphs/storyTimelineSvg';
import type { StoryTimelineCanvasHandle } from '@/src/components/features/story-timeline/StoryTimelineCanvas';
import StoryTimelineCanvas from '@/src/components/features/story-timeline/StoryTimelineCanvas';
import type { NarrativeElementsStackParamList } from '../../../navigation/MainSystemStack';
import { useBackButtonHandler } from '../../../hooks/useBackButtonHandler';
import { setDocumentTitle } from '../../../utils/documentTitle';

const TIMELINE_CONTROL_LABELS = {
  add: 'zoom_in',
  remove: 'zoom_out',
  'scan-outline': 'fit_to_screen',
  'image-outline': 'story_timeline_export_image',
} as const;

const StoryTimelineScreen = () => {
  useBackButtonHandler({ showWebBackButton: true });
  const { t } = useTranslation();
  const { colors } = useTheme();
  const db = useDrizzle();
  const story = useStoryStore((state) => state.selectedStory);
  const notify = useNotificationStore((state) => state.showNotification);
  const navigation =
    useNavigation<NativeStackNavigationProp<NarrativeElementsStackParamList, 'StoryTimeline'>>();
  const canvas = useRef<StoryTimelineCanvasHandle>(null);
  const [chapters, setChapters] = useState<ChapterSelect[]>([]);
  const [scenes, setScenes] = useState<SceneSelect[]>([]);
  const [chapterIds, setChapterIds] = useState<string[]>([]);
  const [selectedSceneId, setSelectedSceneId] = useState<string | null>(null);
  const [scaleMode, setScaleMode] = useState<StoryTimelineScaleMode>('compact');
  const [events, setEvents] = useState<ChapterSelect[]>([]);
  const [anchors, setAnchors] = useState<ChapterAnchorSelect[]>([]);
  const [showEvents, setShowEvents] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useFocusEffect(
    useCallback(() => {
      setDocumentTitle(t('story_timeline_title'));
      navigation
        .getParent()
        ?.setOptions({ title: t('story_timeline_title'), headerRight: undefined });
    }, [navigation, t]),
  );

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
          end: {
            sceneId: anchor.endSceneId,
            position: anchor.endPosition,
            offset: anchor.endOffset,
            offsetUnit: anchor.endOffsetUnit,
          },
        }));
      if (stretches.length === 0) return [];
      const isEvent = container.type === 'event';
      return [
        {
          id: container.id,
          name: container.name,
          color:
            (isEvent ? eventColors : colorsByChapter).get(container.id) ?? colors.textSecondary,
          isEvent,
          stretches,
        },
      ];
    });
  }, [anchors, chapters, colors.textSecondary, events, showEvents]);
  const layout = useMemo(
    () => buildStoryTimelineLayout(timelineScenes, scaleMode, anchoredContainers),
    [anchoredContainers, scaleMode, timelineScenes],
  );
  useEffect(() => {
    canvas.current?.fitToScreen();
  }, [scaleMode]);
  const selectedScene = scenes.find((scene) => scene.id === selectedSceneId) ?? null;
  const selectedChapter =
    chapters.find((chapter) => chapter.id === selectedScene?.chapterId) ?? null;

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
  }, [colors, layout, notify, scaleMode, story, storyDurationLabel, t]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        root: { flex: 1, backgroundColor: colors.background },
        controls: { position: 'absolute', right: 14, bottom: 18, gap: 8 },
        control: {
          width: 42,
          height: 42,
          borderRadius: 21,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.border,
        },
        legend: {
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: 12,
          paddingHorizontal: 14,
          paddingTop: 8,
          paddingBottom: 6,
        },
        legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
        legendGap: { width: 18, borderTopWidth: 2, borderStyle: 'dashed' },
        legendDuration: { width: 18, height: 10, borderRadius: 3 },
        legendText: { fontSize: 11 },
        scaleModeControl: {
          flexDirection: 'row',
          alignSelf: 'flex-start',
          marginHorizontal: 14,
          marginBottom: 4,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: 8,
          overflow: 'hidden',
        },
        scaleModeButton: { paddingHorizontal: 10, paddingVertical: 7 },
        scaleModeText: { fontSize: 12, fontWeight: '700' },
        warning: {
          marginHorizontal: 14,
          marginBottom: 6,
          color: colors.error,
          fontSize: 12,
          lineHeight: 17,
        },
        message: { padding: 28, color: colors.textSecondary, textAlign: 'center' },
      }),
    [colors],
  );

  if (story?.type !== 'linear')
    return (
      <View style={styles.root}>
        <Text style={styles.message}>{t('story_timeline_branching_unavailable')}</Text>
      </View>
    );
  if (loading)
    return (
      <View style={[styles.root, { alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  return (
    <View style={styles.root}>
      <MultiSelectPill
        options={chapters.map((chapter) => ({
          label: chapter.name,
          value: chapter.id,
          color: buildChapterColors(chapters).get(chapter.id),
        }))}
        selectedValues={chapterIds}
        onSelectionChange={setChapterIds}
        placeholder={t('chapters_title')}
        searchPlaceholder={t('search')}
        selectionSummary={
          chapterIds.length === chapters.length ? t('story_timeline_all_chapters') : undefined
        }
        triggerStyle={{ marginHorizontal: 8, marginTop: 10, minHeight: 42, paddingVertical: 5 }}
      />
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendGap, { borderColor: colors.textSecondary }]} />
          <Text style={[styles.legendText, { color: colors.textSecondary }]}>
            {t('story_timeline_gap')}
          </Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDuration, { backgroundColor: colors.primary }]} />
          <Text style={[styles.legendText, { color: colors.textSecondary }]}>
            {t('story_timeline_duration')}
          </Text>
        </View>
        <Text style={[styles.legendText, { color: colors.textSecondary }]}>
          {scaleMode === 'compact'
            ? `⋯ ${t('story_timeline_compressed')}`
            : t('story_timeline_proportional_legend')}
        </Text>
      </View>
      <View style={styles.scaleModeControl}>
        {(['compact', 'proportional'] as const).map((mode) => {
          const selected = scaleMode === mode;
          return (
            <TouchableOpacity
              key={mode}
              onPress={() => setScaleMode(mode)}
              style={[
                styles.scaleModeButton,
                selected && { backgroundColor: colors.primaryContainer },
              ]}
            >
              <Text
                style={[
                  styles.scaleModeText,
                  { color: selected ? colors.onPrimaryContainer : colors.textSecondary },
                ]}
              >
                {t(`story_timeline_scale_${mode}`)}
              </Text>
            </TouchableOpacity>
          );
        })}
        <TouchableOpacity
          onPress={() => setShowEvents((shown) => !shown)}
          style={[
            styles.scaleModeButton,
            // A different axis from the scale, so it is fenced off inside the same control.
            { borderLeftWidth: 1, borderLeftColor: colors.border },
            showEvents && { backgroundColor: colors.primaryContainer },
          ]}
          accessibilityRole="switch"
          accessibilityState={{ checked: showEvents }}
        >
          <Text
            style={[
              styles.scaleModeText,
              { color: showEvents ? colors.onPrimaryContainer : colors.textSecondary },
            ]}
          >
            {t('story_timeline_show_events')}
          </Text>
        </TouchableOpacity>
      </View>
      {showEvents && layout.unanchoredNames.length > 0 && (
        <Text style={[styles.warning, { color: colors.textSecondary }]}>
          {t('story_timeline_unanchored')}: {layout.unanchoredNames.join(', ')}
        </Text>
      )}
      {layout.hasProportionalScaleWarning && (
        <Text style={styles.warning}>{t('story_timeline_proportional_warning')}</Text>
      )}
      {layout.rows.length ? (
        <StoryTimelineCanvas
          ref={canvas}
          layout={layout}
          onPressScene={setSelectedSceneId}
          storyDurationTitle={t('story_timeline_story_duration')}
          storyDurationLabel={storyDurationLabel}
        />
      ) : (
        <Text style={styles.message}>{t('story_timeline_no_scenes')}</Text>
      )}
      <View style={styles.controls}>
        {(
          [
            ['add', () => canvas.current?.zoomBy(1.25)],
            ['remove', () => canvas.current?.zoomBy(0.8)],
            ['scan-outline', () => canvas.current?.fitToScreen()],
            ['image-outline', exportTimeline],
          ] as const
        ).map(([name, onPress]) => (
          <TouchableOpacity
            key={name}
            style={styles.control}
            onPress={onPress}
            disabled={saving}
            accessibilityLabel={t(TIMELINE_CONTROL_LABELS[name])}
          >
            <Ionicons name={name} size={20} color={colors.text} />
          </TouchableOpacity>
        ))}
      </View>
      {selectedScene && (
        <GraphNodeSheet
          title={selectedScene.name}
          subtitle={{ text: selectedChapter?.name ?? '' }}
          badges={[
            {
              label: `${t('story_timeline_gap')}: ${formatSceneGap(selectedScene, t)}`,
              color: colors.textSecondary,
            },
            {
              label: `${t('story_timeline_duration')}: ${formatSceneUniverseDuration(selectedScene, t)}`,
              color: colors.primary,
            },
          ]}
          sections={[{ title: t('summary'), description: selectedScene.summary || t('common_na') }]}
          actionLabel={t('close')}
          onAction={() => setSelectedSceneId(null)}
          onClose={() => setSelectedSceneId(null)}
        />
      )}
    </View>
  );
};
export default StoryTimelineScreen;
