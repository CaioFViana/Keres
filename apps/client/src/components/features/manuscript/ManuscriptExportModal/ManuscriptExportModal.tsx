import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Button from '@/src/components/common/controls/Button/Button';
import FormActions from '@/src/components/common/controls/FormActions/FormActions';
import ThemedSwitch from '@/src/components/common/controls/ThemedSwitch/ThemedSwitch';
import ResponsiveModal from '@/src/components/layout/ResponsiveModal/ResponsiveModal';
import { useTheme } from '@/src/theme';
import { MANUSCRIPT_EXPORT_FORMATS, type ManuscriptExportFormat } from '../export/manuscriptExport';

export interface ManuscriptExportChoices {
  format: ManuscriptExportFormat;
  includeSceneNames: boolean;
  includeLooseScenes: boolean;
  resetSceneNumbers: boolean;
  includeIndex: boolean;
  /** Which arc to export; null exports every arc (the default). */
  arcId: string | null;
}

/** The minimum the arc selector needs to know about an arc. */
export interface ManuscriptExportArc {
  id: string;
  title: string;
}

interface ManuscriptExportModalProps {
  visible: boolean;
  /** Branching only: names the route being exported. Null hides the note. */
  routeName: string | null;
  /** Linear with loose scenes only: when false the loose switch is hidden. */
  showLooseSwitch: boolean;
  looseCount: number;
  /** Linear only: routes have a single group, so restarting numbers is meaningless. */
  chapterNumberingAvailable: boolean;
  /** The story's arcs; the arc selector only shows when there is more than one. */
  arcs: ManuscriptExportArc[];
  onExport: (choices: ManuscriptExportChoices) => void;
  onClose: () => void;
}

/**
 * What the manuscript export carries: one format plus content switches, all off
 * by default. The loose switch only shows when there are loose scenes to
 * include; routes never ask, since the route itself is the scope. Restarting
 * numbers needs scene names on a linear story; the index needs a format that
 * supports links, which plain text does not. The arc selector only shows when
 * the story has more than one arc; a single arc is the whole story already.
 */
const ManuscriptExportModal: React.FC<ManuscriptExportModalProps> = ({
  visible,
  routeName,
  showLooseSwitch,
  looseCount,
  chapterNumberingAvailable,
  arcs,
  onExport,
  onClose,
}) => {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [format, setFormat] = useState<ManuscriptExportFormat>('docx');
  const [arcId, setArcId] = useState<string | null>(null);
  const [includeSceneNames, setIncludeSceneNames] = useState(false);
  const [includeLooseScenes, setIncludeLooseScenes] = useState(false);
  const [resetSceneNumbers, setResetSceneNumbers] = useState(false);
  const [includeIndex, setIncludeIndex] = useState(false);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        content: { padding: 20 },
        title: { color: colors.text, fontSize: 20, fontWeight: '700' },
        description: { color: colors.textSecondary, lineHeight: 19, marginTop: 6 },
        section: {
          color: colors.textSecondary,
          fontSize: 13,
          fontWeight: '700',
          marginTop: 16,
          marginBottom: 8,
        },
        option: {
          alignItems: 'center',
          backgroundColor: colors.surface,
          borderColor: colors.border,
          borderRadius: 8,
          borderWidth: 1,
          flexDirection: 'row',
          gap: 12,
          marginBottom: 8,
          minHeight: 54,
          paddingHorizontal: 12,
          paddingVertical: 9,
        },
        optionSelected: { borderColor: colors.primary, borderWidth: 2 },
        optionLabel: { color: colors.text, flex: 1, fontSize: 16, fontWeight: '600' },
        switchRow: {
          alignItems: 'center',
          flexDirection: 'row',
          gap: 12,
          justifyContent: 'space-between',
          paddingVertical: 8,
        },
        cancelButton: { backgroundColor: colors.textSecondary },
      }),
    [colors],
  );

  const confirm = () => {
    onExport({
      format,
      includeSceneNames,
      includeLooseScenes,
      resetSceneNumbers,
      includeIndex,
      arcId,
    });
    onClose();
  };

  const renderArcOption = (value: string | null, label: string, testID: string) => {
    const selected = value === arcId;
    return (
      <TouchableOpacity
        key={testID}
        testID={testID}
        style={[styles.option, selected && styles.optionSelected]}
        onPress={() => setArcId(value)}
        accessibilityRole="radio"
        accessibilityState={{ selected }}
      >
        <Ionicons
          name={selected ? 'checkmark-circle' : 'ellipse-outline'}
          size={22}
          color={selected ? colors.primary : colors.textSecondary}
        />
        <Text style={styles.optionLabel}>{label}</Text>
      </TouchableOpacity>
    );
  };

  return (
    <ResponsiveModal visible={visible} onClose={onClose} maxHeight="90%" placement="adaptive">
      <View style={styles.content}>
        <Text style={styles.title}>{t('export_manuscript_title')}</Text>
        {routeName ? (
          <Text style={styles.description}>
            {t('export_manuscript_route_note', { route: routeName })}
          </Text>
        ) : null}

        {arcs.length > 1 ? (
          <>
            <Text style={styles.section}>{t('export_manuscript_arc')}</Text>
            {renderArcOption(null, t('export_manuscript_arc_all'), 'export-arc-all')}
            {arcs.map((arc) => renderArcOption(arc.id, arc.title, `export-arc-${arc.id}`))}
          </>
        ) : null}

        <Text style={styles.section}>{t('export_format')}</Text>
        {MANUSCRIPT_EXPORT_FORMATS.map((option) => {
          const selected = option === format;
          return (
            <TouchableOpacity
              key={option}
              testID={`export-format-${option}`}
              style={[styles.option, selected && styles.optionSelected]}
              onPress={() => setFormat(option)}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
            >
              <Ionicons
                name={selected ? 'checkmark-circle' : 'ellipse-outline'}
                size={22}
                color={selected ? colors.primary : colors.textSecondary}
              />
              <Text style={styles.optionLabel}>{t(`export_manuscript_format_${option}`)}</Text>
            </TouchableOpacity>
          );
        })}

        <Text style={styles.section}>{t('export_manuscript_contents')}</Text>
        <View style={styles.switchRow}>
          <Text style={[styles.optionLabel, { fontWeight: '400' }]}>
            {t('export_manuscript_include_scene_names')}
          </Text>
          <ThemedSwitch
            testID="export-scene-names"
            accessibilityLabel={t('export_manuscript_include_scene_names')}
            value={includeSceneNames}
            onValueChange={setIncludeSceneNames}
          />
        </View>

        {includeSceneNames && chapterNumberingAvailable ? (
          <View style={styles.switchRow}>
            <Text style={[styles.optionLabel, { fontWeight: '400' }]}>
              {t('export_manuscript_reset_numbers')}
            </Text>
            <ThemedSwitch
              testID="export-reset-numbers"
              accessibilityLabel={t('export_manuscript_reset_numbers')}
              value={resetSceneNumbers}
              onValueChange={setResetSceneNumbers}
            />
          </View>
        ) : null}

        {showLooseSwitch ? (
          <View style={styles.switchRow}>
            <Text style={[styles.optionLabel, { fontWeight: '400' }]}>
              {t('export_manuscript_include_loose', { count: looseCount })}
            </Text>
            <ThemedSwitch
              testID="export-loose"
              accessibilityLabel={t('export_manuscript_include_loose', { count: looseCount })}
              value={includeLooseScenes}
              onValueChange={setIncludeLooseScenes}
            />
          </View>
        ) : null}

        {format !== 'txt' ? (
          <View style={styles.switchRow}>
            <Text style={[styles.optionLabel, { fontWeight: '400' }]}>
              {t('export_manuscript_include_index')}
            </Text>
            <ThemedSwitch
              testID="export-index"
              accessibilityLabel={t('export_manuscript_include_index')}
              value={includeIndex}
              onValueChange={setIncludeIndex}
            />
          </View>
        ) : null}

        <FormActions stackOnCompact>
          <Button testID="export-cancel" onPress={onClose} style={styles.cancelButton}>
            {t('cancel')}
          </Button>
          <Button testID="export-confirm" onPress={confirm}>
            {t('export_manuscript_export')}
          </Button>
        </FormActions>
      </View>
    </ResponsiveModal>
  );
};

export default ManuscriptExportModal;
