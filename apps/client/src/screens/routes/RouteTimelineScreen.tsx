import { Ionicons } from '@expo/vector-icons';
import type { RouteProp } from '@react-navigation/native';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import GraphNodeSheet from '@/src/components/features/graphs/GraphNodeSheet/GraphNodeSheet';
import StoryTimelineCanvas, {
  type StoryTimelineCanvasHandle,
} from '@/src/components/features/story-timeline/StoryTimelineCanvas';
import {
  ScreenError,
  ScreenLoading,
} from '@/src/components/common/feedback/ScreenState/ScreenState';
import { useBackButtonHandler } from '@/src/hooks/useBackButtonHandler';
import { useNavigateToEntityDetail } from '@/src/hooks/useNavigateToEntityDetail';
import { useRouteChronology } from '@/src/hooks/useRouteChronology';
import type { PlotsStackParamList } from '@/src/navigation/MainSystemStack';
import { useTheme } from '@/src/theme';
import { setDocumentTitle } from '@/src/utils/documentTitle';
import { formatSceneGap, formatSceneUniverseDuration } from '@/src/utils/sceneTiming';
import { useStoryCalendar } from '@/src/hooks/useStoryCalendar';
import { useTranslation } from 'react-i18next';

type Navigation = NativeStackNavigationProp<PlotsStackParamList, 'RouteTimeline'>;
type ScreenRoute = RouteProp<PlotsStackParamList, 'RouteTimeline'>;

/** A Story Timeline projection for one route only; it never claims to be the branching story's global time. */
export default function RouteTimelineScreen() {
  useBackButtonHandler({ showWebBackButton: true });
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { definition: calendar } = useStoryCalendar();
  const navigation = useNavigation<Navigation>();
  const { routeId } = useRoute<ScreenRoute>().params;
  const canvas = useRef<StoryTimelineCanvasHandle>(null);
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null);
  const [scaleMode, setScaleMode] = useState<'compact' | 'proportional'>('compact');
  const chronology = useRouteChronology(routeId, scaleMode);
  const { route, loading, validation, layout, sceneForStep, steps, dateForRow } = chronology;
  const selectedScene = selectedStepId ? sceneForStep(selectedStepId) : undefined;
  const selectedStep = steps.find((step) => step.id === selectedStepId);
  const navigate = useNavigateToEntityDetail();

  useFocusEffect(
    useCallback(() => {
      const title = route ? t('route_timeline_title', { route: route.name }) : t('route_timeline');
      setDocumentTitle(title);
      navigation.getParent()?.setOptions({ title, headerRight: undefined });
    }, [navigation, route, t]),
  );
  useEffect(() => canvas.current?.fitToScreen(), [scaleMode]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        root: { flex: 1, backgroundColor: colors.background },
        notice: { color: colors.textSecondary, fontSize: 12, margin: 14, marginBottom: 8 },
        invalid: { color: colors.error },
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
        scale: {
          flexDirection: 'row',
          alignSelf: 'flex-start',
          marginHorizontal: 14,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: 8,
          overflow: 'hidden',
        },
        scaleButton: { paddingHorizontal: 11, paddingVertical: 7 },
        scaleText: { fontSize: 12, fontWeight: '700' },
      }),
    [colors],
  );
  if (loading) return <ScreenLoading message={t('loading_routes')} />;
  if (!route)
    return <ScreenError message={t('route_not_found')} onGoBack={() => navigation.goBack()} />;
  if (validation.length)
    return (
      <ScreenError message={t('route_cannot_read_invalid')} onGoBack={() => navigation.goBack()} />
    );

  return (
    <View style={styles.root}>
      <Text style={styles.notice}>{t('route_timeline_scope', { route: route.name })}</Text>
      <View style={styles.scale}>
        {(['compact', 'proportional'] as const).map((mode) => (
          <TouchableOpacity
            key={mode}
            style={[
              styles.scaleButton,
              scaleMode === mode && { backgroundColor: colors.primaryContainer },
            ]}
            onPress={() => setScaleMode(mode)}
            accessibilityRole="radio"
            accessibilityState={{ selected: scaleMode === mode }}
          >
            <Text
              style={[
                styles.scaleText,
                { color: scaleMode === mode ? colors.onPrimaryContainer : colors.textSecondary },
              ]}
            >
              {t(`story_timeline_scale_${mode}`)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      {(chronology.story?.timelineEpochDay === null ||
        chronology.story?.timelineEpochDay === undefined) && (
        <Text style={styles.notice}>{t('route_timeline_relative')}</Text>
      )}
      {layout.rows.length ? (
        <StoryTimelineCanvas
          ref={canvas}
          layout={layout}
          onPressScene={setSelectedStepId}
          showSceneNames
          dateForRow={dateForRow}
          storyDurationTitle={t('route_timeline')}
          storyDurationLabel={t('route_step_count', { count: steps.length })}
        />
      ) : (
        <Text style={styles.notice}>{t('no_route_steps')}</Text>
      )}
      <View style={styles.controls}>
        <TouchableOpacity
          style={styles.control}
          onPress={() => canvas.current?.zoomBy(1.25)}
          accessibilityLabel={t('zoom_in')}
        >
          <Ionicons name="add" size={20} color={colors.text} />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.control}
          onPress={() => canvas.current?.zoomBy(0.8)}
          accessibilityLabel={t('zoom_out')}
        >
          <Ionicons name="remove" size={20} color={colors.text} />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.control}
          onPress={() => canvas.current?.fitToScreen()}
          accessibilityLabel={t('fit_to_screen')}
        >
          <Ionicons name="scan-outline" size={20} color={colors.text} />
        </TouchableOpacity>
      </View>
      {selectedScene && selectedStep && (
        <GraphNodeSheet
          title={selectedScene.name}
          subtitle={{ text: t('route_step_number', { count: selectedStep.position }) }}
          badges={[
            {
              label: `${t('story_timeline_gap')}: ${formatSceneGap(selectedScene, t, { calendar })}`,
              color: colors.textSecondary,
            },
            {
              label: `${t('story_timeline_duration')}: ${formatSceneUniverseDuration(selectedScene, t, { calendar })}`,
              color: colors.primary,
            },
          ]}
          sections={[]}
          actionLabel={t('view_details')}
          onAction={() =>
            navigate('Scene', selectedScene.id, {
              onReturn: () => navigation.navigate('RouteTimeline', { routeId }),
            })
          }
          onClose={() => setSelectedStepId(null)}
        />
      )}
    </View>
  );
}
