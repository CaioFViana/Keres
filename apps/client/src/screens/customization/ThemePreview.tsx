import { Button, DetailField, SingleSelectPill, ThemedSwitch } from '@/src/components/common';
import StoryGraphCanvas from '@/src/components/features/graphs/StoryGraph/StoryGraphCanvas';
import { StatLadderBar } from '@/src/components/features/stats/StatLadderBar/StatLadderBar';
import { StatRadarChart } from '@/src/components/features/stats/StatRadarChart/StatRadarChart';
import { buildStatRadarLayout } from '@keres/shared/graphs/statRadarLayout';
import { buildStoryGraphLayout } from '@keres/shared/graphs/storyGraphLayout';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/src/theme';

// Kept as constants because the translation audit correctly treats literal `label` fields as i18n keys.
const PREVIEW_TIER_ONE = 'I';
const PREVIEW_TIER_TWO = 'II';
const PREVIEW_TIER_THREE = 'III';
const PREVIEW_TIER_FOUR = 'IV';
const PREVIEW_LADDER = [
  { label: PREVIEW_TIER_ONE, minValue: 0 },
  { label: PREVIEW_TIER_TWO, minValue: 25 },
  { label: PREVIEW_TIER_THREE, minValue: 50 },
  { label: PREVIEW_TIER_FOUR, minValue: 75 },
];

/** A small, non-persistent sample of the surfaces most affected by a Story theme. */
const ThemePreview = () => {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [previewOption, setPreviewOption] = useState<string | null>('chapter');
  const [previewEnabled, setPreviewEnabled] = useState(true);
  const [selectedGraphNodeId, setSelectedGraphNodeId] = useState<string | null>(null);
  const radarLayout = useMemo(
    () =>
      buildStatRadarLayout({
        stats: [
          { id: 'courage', name: t('theme_preview_stat_courage'), ladder: PREVIEW_LADDER },
          { id: 'insight', name: t('theme_preview_stat_insight'), ladder: PREVIEW_LADDER },
          { id: 'magic', name: t('theme_preview_stat_magic'), ladder: PREVIEW_LADDER },
        ],
        series: [
          {
            id: 'preview-character',
            label: t('theme_preview_character_name'),
            color: colors.primary,
            values: new Map([
              ['courage', 66],
              ['insight', 44],
              ['magic', 82],
            ]),
          },
        ],
        notation: 'number',
        // The labels are painted inside the SVG viewport. A generous inset keeps longer localized
        // names (for example, "Perspicácia") inside it instead of clipping them at the right edge.
        size: 260,
        padding: 76,
      }),
    [colors.primary, t],
  );
  const storyGraphLayout = useMemo(
    () =>
      buildStoryGraphLayout(
        [
          {
            id: 'preview-scene-start',
            name: t('theme_preview_scene_start'),
            chapterId: 'preview-chapter',
            index: 1,
            isStart: true,
            isFinish: false,
          },
          {
            id: 'preview-scene-next',
            name: t('theme_preview_scene_next'),
            chapterId: 'preview-chapter',
            index: 2,
            isStart: false,
            isFinish: true,
          },
        ],
        [
          {
            id: 'preview-choice',
            sceneId: 'preview-scene-start',
            nextSceneId: 'preview-scene-next',
            text: t('theme_preview_choice'),
          },
        ],
        [{ id: 'preview-chapter', name: t('theme_preview_option_chapter'), index: 1 }],
      ),
    [t],
  );
  const styles = useMemo(
    () =>
      StyleSheet.create({
        section: { marginTop: 28 },
        heading: { color: colors.text, fontSize: 18, fontWeight: '700', marginBottom: 5 },
        hint: { color: colors.textSecondary, lineHeight: 19, marginBottom: 12 },
        card: {
          backgroundColor: colors.card,
          borderColor: colors.border,
          borderRadius: 10,
          borderWidth: 1,
          padding: 14,
        },
        buttonRow: { flexDirection: 'row', gap: 10, marginTop: 14 },
        button: { flex: 1 },
        secondaryButton: { backgroundColor: colors.secondary },
        controlRow: { alignItems: 'center', flexDirection: 'row', gap: 12, marginTop: 14 },
        controlText: { color: colors.text, flex: 1, fontSize: 15, fontWeight: '600' },
        graphCard: {
          alignItems: 'center',
          backgroundColor: colors.card,
          borderColor: colors.border,
          borderRadius: 10,
          borderWidth: 1,
          marginTop: 12,
          overflow: 'hidden',
          padding: 8,
        },
        storyGraph: { height: 220, marginTop: 4, width: '100%' },
        canvasLabel: { color: colors.textSecondary, fontSize: 12, marginBottom: 4 },
      }),
    [colors],
  );

  return (
    <View style={styles.section}>
      <Text style={styles.heading}>{t('theme_preview_title')}</Text>
      <Text style={styles.hint}>{t('theme_preview_description')}</Text>

      <View style={styles.card}>
        <DetailField
          label={t('theme_preview_detail_name_label')}
          value={t('theme_preview_character_name')}
        />
        <DetailField
          label={t('theme_preview_detail_role_label')}
          value={t('theme_preview_character_meta')}
        />
        <DetailField
          label={t('theme_preview_detail_summary_label')}
          value={t('theme_preview_detail_text')}
        />
        <View style={styles.buttonRow}>
          <Button onPress={() => undefined} style={styles.button}>
            {t('theme_preview_primary_action')}
          </Button>
          <Button onPress={() => undefined} style={[styles.button, styles.secondaryButton]}>
            {t('theme_preview_secondary_action')}
          </Button>
        </View>
        <View style={styles.controlRow}>
          <Text style={styles.controlText}>{t('theme_preview_switch')}</Text>
          <ThemedSwitch value={previewEnabled} onValueChange={setPreviewEnabled} />
        </View>
      </View>

      <View style={styles.section}>
        <SingleSelectPill
          options={[
            { label: t('theme_preview_option_chapter'), value: 'chapter' },
            { label: t('theme_preview_option_scene'), value: 'scene' },
          ]}
          value={previewOption}
          onValueChange={setPreviewOption}
          placeholder={t('theme_preview_select_placeholder')}
        />
      </View>

      <View style={styles.graphCard}>
        <Text style={styles.canvasLabel}>{t('theme_preview_stats')}</Text>
        <StatRadarChart layout={radarLayout} emptyMessage="" />
      </View>

      <View style={styles.graphCard}>
        <Text style={styles.canvasLabel}>{t('theme_preview_stat_ladder')}</Text>
        <StatLadderBar ladder={PREVIEW_LADDER} value={66} />
      </View>

      <View style={styles.graphCard}>
        <Text style={styles.canvasLabel}>{t('theme_preview_canvas')}</Text>
        <View style={styles.storyGraph}>
          <StoryGraphCanvas
            layout={storyGraphLayout}
            showEdgeLabels
            selectedNodeId={selectedGraphNodeId}
            onSelectNode={(node) => setSelectedGraphNodeId(node.id)}
          />
        </View>
      </View>
    </View>
  );
};

export default ThemePreview;
