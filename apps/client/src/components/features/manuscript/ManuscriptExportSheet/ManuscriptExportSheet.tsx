import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import Button from '../../../common/controls/Button/Button';
import ResponsiveModal from '../../../layout/ResponsiveModal/ResponsiveModal';
import type {
  ChapterSelect,
  ChoiceSelect,
  RouteStepSelect,
  SceneSelect,
} from '../../../../db/schema';
import { useAsyncOperation } from '../../../../hooks/useAsyncOperation';
import { useTheme } from '../../../../theme';
import { AppAlert } from '../../../../utils/AppAlert';
import {
  compileLinearManuscript,
  compileRouteManuscript,
} from '../export/manuscriptCompiler';
import { exportManuscript, type ManuscriptExportFormat } from '../export/manuscriptExport';

const FORMATS: ManuscriptExportFormat[] =
  Platform.OS === 'web' ? ['docx', 'md', 'txt'] : ['docx', 'pdf', 'md', 'txt'];

export type ManuscriptExportSheetProps = {
  visible: boolean;
  onClose(): void;
  storyTitle: string;
  isBranching: boolean;
  routeName: string | null;
  routeSteps: RouteStepSelect[];
  chapters: ChapterSelect[];
  scenes: SceneSelect[];
  choices: ChoiceSelect[];
  /** Loose scenes in a linear story, for the switch label. */
  looseCount: number;
};

export function ManuscriptExportSheet({
  visible,
  onClose,
  storyTitle,
  isBranching,
  routeName,
  routeSteps,
  chapters,
  scenes,
  choices,
  looseCount,
}: ManuscriptExportSheetProps) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const [format, setFormat] = useState<ManuscriptExportFormat>('docx');
  const [includeLoose, setIncludeLoose] = useState(true);
  const { pending, run } = useAsyncOperation();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        title: { color: colors.text, fontSize: 18, fontWeight: '700', marginBottom: 16 },
        formats: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
        pill: {
          paddingHorizontal: 14,
          paddingVertical: 8,
          borderRadius: 16,
          borderWidth: 1,
          borderColor: colors.border,
        },
        pillActive: { backgroundColor: colors.primaryContainer, borderColor: colors.primaryContainer },
        pillLabel: { color: colors.textSecondary, fontSize: 14, fontWeight: '600' },
        pillLabelActive: { color: colors.onPrimaryContainer },
        row: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          marginBottom: 16,
        },
        rowLabel: { flex: 1, color: colors.text, fontSize: 15 },
        note: { color: colors.textSecondary, fontSize: 13, marginBottom: 16 },
        actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
      }),
    [colors],
  );

  const handleExport = () => {
    void run(async () => {
      try {
        const manuscript = isBranching
          ? compileRouteManuscript({
              title: storyTitle,
              routeName: routeName ?? '',
              steps: routeSteps,
              scenes,
              choices,
              looseHeadingLabel: t('export_manuscript_loose_heading'),
            })
          : compileLinearManuscript({
              title: storyTitle,
              chapters,
              scenes,
              choices,
              includeLooseScenes: includeLoose,
              looseHeadingLabel: t('export_manuscript_loose_heading'),
            });
        await exportManuscript({
          storyTitle,
          manuscript,
          format,
          labels: {
            goToPage: t('export_manuscript_go_to_page'),
            goToScene: t('export_manuscript_go_to_scene'),
          },
        });
        onClose();
      } catch (error) {
        console.error('Manuscript export failed:', error);
        AppAlert.alert(t('export_manuscript_failed_title'), t('export_manuscript_failed_body'));
      }
    });
  };

  return (
    <ResponsiveModal visible={visible} onClose={onClose}>
      <Text style={styles.title}>{t('export_manuscript_title')}</Text>
      <View style={styles.formats}>
        {FORMATS.map((candidate) => {
          const active = candidate === format;
          return (
            <TouchableOpacity
              key={candidate}
              testID={`export-format-${candidate}`}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              style={[styles.pill, active && styles.pillActive]}
              onPress={() => setFormat(candidate)}
            >
              <Text style={[styles.pillLabel, active && styles.pillLabelActive]}>
                {t(`export_manuscript_format_${candidate}`)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
      {!isBranching && looseCount > 0 && (
        <View style={styles.row}>
          <Text style={styles.rowLabel}>
            {t('export_manuscript_include_loose', { count: looseCount })}
          </Text>
          <Switch
            testID="export-include-loose"
            value={includeLoose}
            onValueChange={setIncludeLoose}
          />
        </View>
      )}
      {isBranching && routeName && (
        <Text style={styles.note}>{t('export_manuscript_route_note', { route: routeName })}</Text>
      )}
      <View style={styles.actions}>
        <Button onPress={onClose} disabled={pending}>
          {t('cancel')}
        </Button>
        <Button onPress={handleExport} disabled={pending} testID="export-run">
          {t('export_manuscript_action')}
        </Button>
      </View>
    </ResponsiveModal>
  );
}
