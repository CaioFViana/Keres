import { ScreenError } from '@/src/components/common/feedback/ScreenState/ScreenState';
import { Ionicons } from '@expo/vector-icons';
import { buildChronologyLayout, renderChronologySvg } from '@keres/shared';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SvgXml } from 'react-native-svg';
import { useDrizzle } from '../../../db';
import type { ChapterSelect, SceneSelect } from '../../../db/schema';
import { useBackButtonHandler } from '../../../hooks/useBackButtonHandler';
import { createChapterRelationService } from '../../../services/storymanagement/ChapterRelationService';
import { createChapterService } from '../../../services/storymanagement/ChapterService';
import { createSceneService } from '../../../services/storymanagement/SceneService';
import { useNotificationStore } from '../../../state/notificationStore';
import { useStoryStore } from '../../../state/storyStore';
import { useTheme } from '../../../theme';
import { commonDetailStyleDefs, commonScreenStyleDefs } from '../../../theme/commonStyles';
import { useDocumentTitle } from '../../../utils/documentTitle';
import { formatChapterUniverseDuration } from '../../../utils/sceneTiming';
import { deliverSvgMap } from '../../../utils/storyTransfer';

/**
 * The story arranged by **when things happened**.
 *
 * The second of two timelines, and deliberately a separate screen. The narrative timeline walks the
 * numbered spine - the order a reader meets things. This one reads the chronology relations, which
 * is the order events occurred in the world. Drawing both on one canvas would put the two axes back
 * together, which is the confusion the Events feature exists to remove.
 *
 * The picture is a **partial order**: two containers sit side by side because nobody said which came
 * first, not because they happened together. That is stated in the subtitle, because rows of boxes
 * invite the opposite reading.
 */
const ChronologyScreen = () => {
  useBackButtonHandler({ showWebBackButton: true });
  const { t } = useTranslation();
  const { colors } = useTheme();
  const db = useDrizzle();
  const { selectedStory } = useStoryStore();
  const showNotification = useNotificationStore((state) => state.showNotification);
  useDocumentTitle(t('chronology_screen_title'));

  const [containers, setContainers] = useState<ChapterSelect[]>([]);
  const [scenes, setScenes] = useState<SceneSelect[]>([]);
  const [relations, setRelations] = useState<
    { chapter1Id: string; chapter2Id: string; relationType: never }[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (!selectedStory) return;
    (async () => {
      setLoading(true);
      try {
        const [loadedContainers, loadedScenes, loadedRelations] = await Promise.all([
          createChapterService(db).getAllByStoryId(selectedStory.id, null),
          createSceneService(db).getAllByStoryId(selectedStory.id),
          createChapterRelationService(db).getRelationsForStory(selectedStory.id),
        ]);
        setContainers(loadedContainers);
        setScenes(loadedScenes);
        setRelations(loadedRelations as never);
        setError(null);
      } catch (loadError) {
        console.error('ChronologyScreen: failed to load the chronology.', loadError);
        setError(t('chronology_load_failed'));
      } finally {
        setLoading(false);
      }
    })();
  }, [db, selectedStory, t]);

  /**
   * A container's span is the sum of its scenes' durations.
   *
   * `duration`/`durationType` already exist on a scene and `sceneTiming` already understands units
   * up to millennia, so "three hundred years" is expressible today - it only had nowhere to be
   * shown. Summed here rather than in the layout, which knows nothing about scenes.
   */
  const layout = useMemo(() => {
    const durationOf = (chapterId: string) => {
      const inside = scenes.filter((scene) => scene.chapterId === chapterId);
      if (inside.length === 0) return undefined;
      // The same summing the chapter screens already do, so a span reads identically in both places.
      const label = formatChapterUniverseDuration(inside, t);
      /*
       * A container whose scenes carry no timing sums to zero, and "0 minutes" is not a span - it is
       * the absence of one, printed. Showing it would put a measurement on a bar that measures
       * nothing.
       */
      return label && !/^0\s/.test(label) ? label : undefined;
    };

    return buildChronologyLayout(
      containers.map((container) => ({
        id: container.id,
        name: container.name,
        isEvent: container.type === 'event',
        index: container.index,
        durationLabel: durationOf(container.id),
      })),
      relations,
      // The chapter numbering stands in for chronology only where it is the reading order.
      { storyType: selectedStory?.type === 'branching' ? 'branching' : 'linear' },
    );
  }, [containers, relations, scenes, selectedStory?.type, t]);

  const svg = useMemo(
    () =>
      renderChronologySvg(layout, {
        subtitle: t('chronology_screen_subtitle'),
        labels: {
          axis: t('chronology_axis'),
          step: t('chronology_step'),
          unplaced: t('chronology_unplaced'),
          cycle: t('chronology_contradiction'),
          ties: {
            during: t('chronology_tie_during'),
            overlaps: t('chronology_tie_overlaps'),
            simultaneous: t('chronology_tie_simultaneous'),
          },
        },
        colors: {
          background: colors.background,
          surface: colors.surface,
          text: colors.text,
          textSecondary: colors.textSecondary,
          border: colors.border,
          primary: colors.primary,
          warning: colors.error,
        },
      }),
    [layout, colors, t],
  );

  const handleExport = useCallback(async () => {
    if (!selectedStory) return;
    setExporting(true);
    try {
      const result = await deliverSvgMap(svg, `${selectedStory.title}-chronology.svg`);
      showNotification(
        result.delivered
          ? t('chronology_export_success', { fileName: result.fileName })
          : // With no share sheet the file exists but is unreachable; saying where it is beats
            // claiming success.
            t('chronology_export_no_share_target', { path: result.uri || result.fileName }),
        result.delivered ? 'success' : 'warning',
      );
    } catch (exportError) {
      console.error('ChronologyScreen: failed to export.', exportError);
      showNotification(t('chronology_export_failed'), 'error');
    } finally {
      setExporting(false);
    }
  }, [selectedStory, svg, showNotification, t]);

  const styles = StyleSheet.create({
    ...commonScreenStyleDefs(colors),
    ...commonDetailStyleDefs(colors),
    content: { padding: 12, paddingBottom: 80 },
    header: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4 },
    headerTitle: { fontSize: 16, fontWeight: 'bold', color: colors.text },
    headerSubtitle: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
    controls: { position: 'absolute', right: 16, bottom: 20 },
    controlButton: {
      width: 48,
      height: 48,
      borderRadius: 24,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primary,
    },
  });

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center' }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (error) {
    return <ScreenError message={error} />;
  }

  /*
   * Nothing stated is its own state, not a drawing of nothing.
   *
   * With no relations every container is "unplaced", and the picture becomes a list of boxes under
   * a heading that says nothing is known - which tells the writer less than a sentence would, and
   * does not say where to go and fix it.
   */
  if (layout.nodes.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.emptyContainer}>
          <Ionicons name="hourglass-outline" size={54} color={colors.textSecondary} />
          <Text style={styles.emptyText}>
            {containers.length === 0 ? t('chronology_screen_empty') : t('chronology_none_stated')}
          </Text>
          {containers.length > 0 && (
            <Text style={[styles.emptyText, { fontSize: 13, marginTop: 8 }]}>
              {t('chronology_none_stated_hint')}
            </Text>
          )}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        {!!selectedStory?.title && (
          <Text style={styles.headerTitle} numberOfLines={1}>
            {selectedStory.title}
          </Text>
        )}
        {/*
          The subtitle lives in the drawing, not here: it explains how to read the axis, and the
          drawing is what gets exported and sent to somebody who never saw this screen. Repeating it
          above the picture only made the reader skip both.
        */}
      </View>

      {/* Both directions: as wide as the stated order runs, as tall as the containers listed. */}
      <ScrollView contentContainerStyle={styles.content}>
        <ScrollView horizontal contentContainerStyle={{ paddingRight: 12 }}>
          <SvgXml xml={svg} testID="chronology-svg" />
        </ScrollView>
      </ScrollView>

      <View style={styles.controls}>
        <TouchableOpacity
          style={styles.controlButton}
          onPress={handleExport}
          disabled={exporting}
          accessibilityLabel={t('chronology_export')}
          testID="export-chronology"
        >
          {exporting ? (
            <ActivityIndicator size="small" color={colors.onPrimary} />
          ) : (
            <Ionicons name="download-outline" size={22} color={colors.onPrimary} />
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default ChronologyScreen;
