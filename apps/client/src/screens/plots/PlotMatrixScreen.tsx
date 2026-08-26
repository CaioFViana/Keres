import MultiSelectPill from '@/src/components/common/inputs/MultiSelectPill/MultiSelectPill';
import {
  ScreenError,
  ScreenLoading,
} from '@/src/components/common/feedback/ScreenState/ScreenState';
import type { PresenceMatrixCanvasHandle } from '@/src/components/features/presence-matrix/PresenceMatrixCanvas';
import PresenceMatrixCanvas from '@/src/components/features/presence-matrix/PresenceMatrixCanvas';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useBackButtonHandler } from '../../hooks/useBackButtonHandler';
import { useNavigateToEntityDetail } from '../../hooks/useNavigateToEntityDetail';
import { useStoryPlots } from '../../hooks/useStoryPlots';
import { useNotificationStore } from '../../state/notificationStore';
import { useStoryStore } from '../../state/storyStore';
import { useTheme } from '../../theme';
import { getDistinctSeriesColor } from '@keres/shared';
import { setDocumentTitle } from '../../utils/documentTitle';
import type { PresenceMatrixRow } from '@keres/shared/graphs/presenceMatrixLayout';
import { buildPresenceMatrixLayout } from '@keres/shared/graphs/presenceMatrixLayout';
import { renderPresenceMatrixSvg } from '@keres/shared/graphs/presenceMatrixSvg';
import { buildChapterColors } from '@keres/shared/graphs/storyGraphLayout';
import { deliverSvgMap } from '../../utils/storyTransfer';
import type { PlotsScreenNavigationProp } from './PlotListScreen';

/** The same series colours as the presence matrix: the two charts are read side by side. */
const SERIES_COLORS = [
  '#0B6E99',
  '#D64545',
  '#6D4BC3',
  '#C87800',
  '#16803C',
  '#B23A7A',
  '#655CDB',
  '#A55A18',
  '#007C83',
  '#A94141',
  '#4D749E',
  '#8D6B13',
];
const MAX_VISIBLE_SERIES = 12;
const MATRIX_CONTROL_LABELS = {
  add: 'zoom_in',
  remove: 'zoom_out',
  'scan-outline': 'fit_to_screen',
  'image-outline': 'plot_matrix_export',
} as const;

/**
 * Plots × scenes, on the same infrastructure as the presence matrix: there the cell is a checkmark (a
 * character) or a state (an item), here it is the relation's note.
 */
const PlotMatrixScreen = () => {
  useBackButtonHandler({ showWebBackButton: true });
  const { t } = useTranslation();
  const { colors } = useTheme();
  const navigation = useNavigation<PlotsScreenNavigationProp>();
  const navigateToDetail = useNavigateToEntityDetail();
  const notify = useNotificationStore((state) => state.showNotification);
  const { selectedStory } = useStoryStore();
  const canvas = useRef<PresenceMatrixCanvasHandle>(null);
  // The cell and the header open the Scene in another stack: the way back is registered so the back
  // button brings the matrix again, and not the Scenes list.
  const openScene = useCallback(
    (sceneId: string) =>
      navigateToDetail('Scene', sceneId, {
        onReturn: () => navigation.navigate('PlotsStack', { screen: 'PlotMatrix' }),
      }),
    [navigateToDetail, navigation],
  );

  const { plots, relations, scenes, chapters, loading } = useStoryPlots(
    selectedStory?.type === 'linear' ? selectedStory?.id : undefined,
  );
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  // The first batch of plots comes selected: an empty matrix on the first opening looks like a broken
  // screen, not a choice to make.
  useEffect(() => {
    setSelectedIds((current) =>
      current.length > 0 ? current : plots.slice(0, MAX_VISIBLE_SERIES).map((plot) => plot.id),
    );
  }, [plots]);

  const colorOf = useCallback(
    (plotId: string) =>
      getDistinctSeriesColor(
        Math.max(0, selectedIds.indexOf(plotId)),
        selectedIds.length,
        SERIES_COLORS,
      ),
    [selectedIds],
  );

  const isCompleteView = plots.length > MAX_VISIBLE_SERIES && selectedIds.length === plots.length;

  const layout = useMemo(() => {
    const chapterColors = buildChapterColors(chapters);
    const chapterName = new Map(chapters.map((chapter) => [chapter.id, chapter.name]));
    const matrixScenes = scenes.map((scene) => ({
      id: scene.id,
      name: scene.name,
      chapterName: chapterName.get(scene.chapterId) ?? '',
      chapterColor: chapterColors.get(scene.chapterId) ?? colors.border,
    }));
    const rows: PresenceMatrixRow[] = selectedIds
      .map((plotId) => plots.find((plot) => plot.id === plotId))
      .filter((plot): plot is (typeof plots)[number] => !!plot)
      .map((plot) => ({
        id: plot.id,
        label: plot.name,
        color: colorOf(plot.id),
        cells: new Map(
          relations
            .filter((relation) => relation.plotId === plot.id)
            .map((relation) => [relation.sceneId, relation.note]),
        ),
      }));
    return buildPresenceMatrixLayout(matrixScenes, rows);
  }, [chapters, colorOf, colors.border, plots, relations, scenes, selectedIds]);

  useFocusEffect(
    useCallback(() => {
      setDocumentTitle(t('plot_matrix_title'));
      navigation.getParent()?.setOptions({
        title: t('plot_matrix_title'),
        headerRight: undefined,
      });
    }, [navigation, t]),
  );

  const exportMatrix = useCallback(async () => {
    if (!selectedStory || layout.rows.length === 0) return;
    setSaving(true);
    try {
      const svg = renderPresenceMatrixSvg(layout, {
        title: selectedStory.title,
        subtitle: t('plot_matrix_title'),
        background: colors.background,
        surface: colors.surface,
        text: colors.text,
        border: colors.border,
        showRowCoverage: true,
      });
      const result = await deliverSvgMap(svg, `${selectedStory.title}-tramas.svg`);
      notify(
        result.delivered
          ? t('plot_matrix_export_success', { fileName: result.fileName })
          : t('plot_matrix_export_no_share_target', { path: result.uri || result.fileName }),
        result.delivered ? 'success' : 'warning',
      );
    } finally {
      setSaving(false);
    }
  }, [colors, layout, notify, selectedStory, t]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        root: { flex: 1, backgroundColor: colors.background },
        bulkActions: {
          flexDirection: 'row',
          justifyContent: 'flex-end',
          paddingHorizontal: 12,
          paddingBottom: 8,
        },
        bulkAction: { paddingVertical: 5 },
        bulkActionText: { color: colors.primary, fontSize: 13, fontWeight: '700' },
        matrixMeta: {
          color: colors.textSecondary,
          fontSize: 12,
          paddingHorizontal: 12,
          paddingBottom: 8,
        },
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
        emptyState: {
          alignItems: 'center',
          flex: 1,
          justifyContent: 'center',
          padding: 32,
        },
        emptyTitle: { color: colors.text, fontSize: 17, fontWeight: '700', marginTop: 12 },
        emptyDescription: {
          color: colors.textSecondary,
          fontSize: 14,
          lineHeight: 20,
          marginTop: 6,
          maxWidth: 360,
          textAlign: 'center',
        },
      }),
    [colors],
  );

  if (selectedStory?.type !== 'linear') {
    return <ScreenError message={t('plots_linear_only')} onGoBack={() => navigation.goBack()} />;
  }

  if (loading) {
    return <ScreenLoading message={t('loading_plots')} />;
  }

  return (
    <View style={styles.root}>
      <MultiSelectPill
        options={plots.map((plot) => ({
          label: plot.name,
          value: plot.id,
          color: selectedIds.includes(plot.id) ? colorOf(plot.id) : undefined,
        }))}
        selectedValues={selectedIds}
        onSelectionChange={(next) => setSelectedIds(next.slice(0, MAX_VISIBLE_SERIES))}
        maxSelections={MAX_VISIBLE_SERIES}
        placeholder={t('plots_title')}
        searchPlaceholder={t('search')}
        noOptionsText={t('no_plots')}
        selectionSummary={
          isCompleteView ? t('plot_matrix_selected_all', { count: selectedIds.length }) : undefined
        }
        triggerStyle={{ marginHorizontal: 8, marginTop: 10, minHeight: 42, paddingVertical: 5 }}
      />
      {plots.length > MAX_VISIBLE_SERIES && (
        <View style={styles.bulkActions}>
          <TouchableOpacity
            style={styles.bulkAction}
            onPress={() =>
              setSelectedIds(
                isCompleteView
                  ? selectedIds.slice(0, MAX_VISIBLE_SERIES)
                  : plots.map((plot) => plot.id),
              )
            }
          >
            <Text style={styles.bulkActionText}>
              {isCompleteView
                ? t('plot_matrix_show_compact', { count: MAX_VISIBLE_SERIES })
                : t('plot_matrix_add_all')}
            </Text>
          </TouchableOpacity>
        </View>
      )}
      <Text style={styles.matrixMeta}>
        {t('plot_matrix_context', { series: selectedIds.length, scenes: scenes.length })}
      </Text>

      {layout.rows.length > 0 && scenes.length > 0 ? (
        <PresenceMatrixCanvas
          ref={canvas}
          layout={layout}
          showRowCoverage
          onPressScene={openScene}
          onPressRow={(plotId) => navigation.navigate('PlotDetail', { plotId })}
        />
      ) : (
        <View style={styles.emptyState}>
          <Ionicons name="grid-outline" size={42} color={colors.primary} />
          <Text style={styles.emptyTitle}>{t('plot_matrix_start_title')}</Text>
          <Text style={styles.emptyDescription}>
            {scenes.length === 0
              ? t('plot_matrix_empty_scenes')
              : t('plot_matrix_empty_plots', { count: MAX_VISIBLE_SERIES })}
          </Text>
        </View>
      )}

      {layout.rows.length > 0 && scenes.length > 0 && (
        <View style={styles.controls}>
          {(
            [
              ['add', () => canvas.current?.zoomBy(1.25)],
              ['remove', () => canvas.current?.zoomBy(0.8)],
              ['scan-outline', () => canvas.current?.fitToScreen()],
              ['image-outline', exportMatrix],
            ] as const
          ).map(([name, press]) => (
            <TouchableOpacity
              key={name}
              style={styles.control}
              onPress={press}
              disabled={saving}
              accessibilityLabel={t(MATRIX_CONTROL_LABELS[name])}
            >
              <Ionicons name={name} size={20} color={colors.text} />
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
};

export default PlotMatrixScreen;
