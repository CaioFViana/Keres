import FormActions from '@/src/components/common/controls/FormActions/FormActions';
import Button from '@/src/components/common/controls/Button/Button';
import ResponsiveModal from '@/src/components/layout/ResponsiveModal/ResponsiveModal';
import { useCalendarAnchorPreview } from '@/src/hooks/useCalendarAnchorPreview';
import { useNavigateToEntityDetail } from '@/src/hooks/useNavigateToEntityDetail';
import { useTheme } from '@/src/theme';
import type { CalendarAnchorPreviewRow } from '@/src/utils/calendarAnchorPreview';
import type { CalendarDefinitionType } from '@keres/shared';
import { Ionicons } from '@expo/vector-icons';
import type { TFunction } from 'i18next';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface Props {
  visible: boolean;
  calendarName: string;
  definition: CalendarDefinitionType;
  /** When supplied, each timeline fact is shown before and after the pending edit. */
  comparisonDefinition?: CalendarDefinitionType;
  onClose: () => void;
  onConfirm?: () => void;
  confirming?: boolean;
}

const rowLabel = (row: CalendarAnchorPreviewRow, t: TFunction) => {
  if (row.kind === 'story-start') return t('calendar_anchor_story_start');
  const container = row.containerName ?? t('calendar_anchor_unknown_container');
  const scene = row.sceneName ?? t('calendar_anchor_unknown_scene');
  const edge = row.kind === 'anchor-start' ? t('calendar_anchor_start') : t('calendar_anchor_end');
  return `${container} · ${edge}: ${scene}`;
};

/**
 * Both the read-only calendar inspection and the save-time consequence review share one surface.
 * It intentionally reads only persisted anchors: the calendar interprets story time, it does not
 * invent or migrate it.
 */
const CalendarAnchorsModal = ({
  visible,
  calendarName,
  definition,
  comparisonDefinition,
  onClose,
  onConfirm,
  confirming = false,
}: Props) => {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const navigateToEntity = useNavigateToEntityDetail();
  const { rows: currentRows, loading } = useCalendarAnchorPreview(definition, visible);
  const { rows: nextRows } = useCalendarAnchorPreview(comparisonDefinition ?? definition, visible);
  const nextById = useMemo(() => new Map(nextRows.map((row) => [row.id, row])), [nextRows]);
  const reviewing = Boolean(comparisonDefinition);
  const styles = useMemo(
    () =>
      StyleSheet.create({
        content: { padding: 18, minHeight: 200 },
        title: { color: colors.text, fontSize: 18, fontWeight: '700' },
        hint: { color: colors.textSecondary, fontSize: 13, lineHeight: 19, marginTop: 6 },
        header: {
          flexDirection: 'row',
          gap: 10,
          marginTop: 18,
          paddingBottom: 7,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.border,
        },
        headerText: { color: colors.textSecondary, fontSize: 11, fontWeight: '700', flex: 1 },
        row: {
          flexDirection: 'row',
          gap: 10,
          paddingVertical: 11,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.border,
          alignItems: 'center',
        },
        label: { color: colors.text, fontSize: 13, lineHeight: 18, flex: 1 },
        value: { color: colors.textSecondary, fontSize: 12, lineHeight: 18, flex: 1 },
        singleValue: { color: colors.textSecondary, fontSize: 13, lineHeight: 18, flex: 1 },
        empty: { color: colors.textSecondary, fontSize: 13, lineHeight: 20, paddingVertical: 20 },
        loading: { paddingVertical: 28, alignItems: 'center' },
        link: { padding: 4 },
      }),
    [colors],
  );
  const showEntity = (row: CalendarAnchorPreviewRow) => {
    if (!row.sceneId) return;
    onClose();
    navigateToEntity('Scene', row.sceneId);
  };

  return (
    <ResponsiveModal visible={visible} onClose={onClose} placement="adaptive" contentStyle={styles.content}>
      <Text style={styles.title}>
        {reviewing ? t('calendar_change_preview_title') : t('calendar_anchors_title', { name: calendarName })}
      </Text>
      <Text style={styles.hint}>
        {reviewing ? t('calendar_change_preview_hint') : t('calendar_anchors_hint')}
      </Text>
      {loading ? (
        <View style={styles.loading}><ActivityIndicator color={colors.primary} /></View>
      ) : currentRows.length === 0 ? (
        <Text style={styles.empty}>{t('calendar_anchors_empty')}</Text>
      ) : (
        <ScrollView>
          <View style={styles.header}>
            <Text style={styles.headerText}>{t('calendar_anchor_source')}</Text>
            <Text style={styles.headerText}>
              {reviewing ? t('calendar_change_current') : t('calendar_anchor_value')}
            </Text>
            {reviewing && <Text style={styles.headerText}>{t('calendar_change_new')}</Text>}
          </View>
          {currentRows.map((row) => {
            const next = nextById.get(row.id);
            return (
              <View key={row.id} style={styles.row}>
                <Text style={styles.label}>{rowLabel(row, t)}</Text>
                <Text style={reviewing ? styles.value : styles.singleValue}>
                  {row.date ?? t('calendar_anchor_no_epoch')}
                </Text>
                {reviewing && (
                  <Text style={styles.value}>{next?.date ?? t('calendar_anchor_no_epoch')}</Text>
                )}
                {row.sceneId && (
                  <TouchableOpacity
                    onPress={() => showEntity(row)}
                    style={styles.link}
                    accessibilityLabel={t('calendar_anchor_open_scene', { name: row.sceneName })}
                  >
                    <Ionicons name="open-outline" size={18} color={colors.primary} />
                  </TouchableOpacity>
                )}
              </View>
            );
          })}
        </ScrollView>
      )}
      <FormActions>
        <Button onPress={onClose}>{reviewing ? t('cancel') : t('close')}</Button>
        {onConfirm && <Button onPress={onConfirm} disabled={confirming}>{t('calendar_change_confirm')}</Button>}
      </FormActions>
    </ResponsiveModal>
  );
};

export default CalendarAnchorsModal;
