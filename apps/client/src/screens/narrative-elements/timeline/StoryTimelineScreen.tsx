import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import MultiSelectPill from '@/src/components/common/inputs/MultiSelectPill/MultiSelectPill';
import type { StoryTimelineCanvasHandle } from '@/src/components/features/story-timeline/StoryTimelineCanvas';
import StoryTimelineCanvas from '@/src/components/features/story-timeline/StoryTimelineCanvas';
import StoryTimelineSheets from '@/src/components/features/story-timeline/StoryTimelineSheets';
import { useStoryTimeline } from '@/src/hooks/useStoryTimeline';
import { useTheme } from '@/src/theme';
import { buildChapterColors } from '@keres/shared/graphs/storyGraphLayout';
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
  const navigation =
    useNavigation<NativeStackNavigationProp<NarrativeElementsStackParamList, 'StoryTimeline'>>();
  const canvas = useRef<StoryTimelineCanvasHandle>(null);
  const [selectedSceneId, setSelectedSceneId] = useState<string | null>(null);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const timeline = useStoryTimeline();
  const {
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
    dateForRow,
    describeSceneDay,
    storyDurationLabel,
    exportTimeline,
  } = timeline;

  useFocusEffect(
    useCallback(() => {
      setDocumentTitle(t('story_timeline_title'));
      navigation
        .getParent()
        ?.setOptions({ title: t('story_timeline_title'), headerRight: undefined });
    }, [navigation, t]),
  );
  useEffect(() => {
    canvas.current?.fitToScreen();
  }, [eventPlacement, scaleMode]);

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
        {showEvents && (
          <TouchableOpacity
            onPress={() =>
              setEventPlacement((current) => (current === 'overlay' ? 'inline' : 'overlay'))
            }
            style={[
              styles.scaleModeButton,
              { borderLeftWidth: 1, borderLeftColor: colors.border },
              eventPlacement === 'inline' && { backgroundColor: colors.primaryContainer },
            ]}
            accessibilityRole="switch"
            accessibilityState={{ checked: eventPlacement === 'inline' }}
          >
            <Text
              style={[
                styles.scaleModeText,
                {
                  color:
                    eventPlacement === 'inline' ? colors.onPrimaryContainer : colors.textSecondary,
                },
              ]}
            >
              {t('story_timeline_events_inline')}
            </Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          onPress={() => setShowSceneNames((shown) => !shown)}
          style={[
            styles.scaleModeButton,
            { borderLeftWidth: 1, borderLeftColor: colors.border },
            showSceneNames && { backgroundColor: colors.primaryContainer },
          ]}
          accessibilityRole="switch"
          accessibilityState={{ checked: showSceneNames }}
        >
          <Text
            style={[
              styles.scaleModeText,
              { color: showSceneNames ? colors.onPrimaryContainer : colors.textSecondary },
            ]}
          >
            {t('story_timeline_show_names')}
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
          onPressScene={(id) => {
            setSelectedEventId(null);
            setSelectedSceneId(id);
          }}
          onPressEvent={(id) => {
            setSelectedSceneId(null);
            setSelectedEventId(id);
          }}
          showSceneNames={showSceneNames}
          dateForRow={dateForRow}
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
      <StoryTimelineSheets
        scenes={scenes}
        chapters={chapters}
        events={events}
        anchors={anchors}
        selectedSceneId={selectedSceneId}
        selectedEventId={selectedEventId}
        onSelectScene={setSelectedSceneId}
        onSelectEvent={setSelectedEventId}
        onOpenEvent={(eventId) => navigation.navigate('ChapterDetail', { chapterId: eventId })}
        describeSceneDay={describeSceneDay}
      />
    </View>
  );
};
export default StoryTimelineScreen;
