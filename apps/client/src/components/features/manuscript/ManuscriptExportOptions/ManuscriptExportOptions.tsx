import {
  MANUSCRIPT_PRESETS,
  type ManuscriptFormat,
  type ManuscriptPageEstimate,
  type ManuscriptSizeAssessment,
  type ManuscriptStyle,
  type ScreenplayEstimate,
} from '@keres/shared';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import TextInput from '@/src/components/common/inputs/TextInput/TextInput';
import { useTheme } from '@/src/theme';
import {
  applyPreset,
  FORMAT_CAPABILITIES,
  isScreenplayFormat,
  type ManuscriptExportSettings,
  withChange,
} from '../export/manuscriptExportSettings';
import { OptionPills, OptionRow, OptionSection, SwitchRow } from './ExportOptionRows';
import ProsePageEstimateCard from './ProsePageEstimateCard';
import ScreenplayEstimateCard from './ScreenplayEstimateCard';

/** The minimum the arc selector needs to know about an arc. */
export interface ManuscriptExportArc {
  id: string;
  title: string;
}

interface ManuscriptExportOptionsProps {
  settings: ManuscriptExportSettings;
  onChange: (settings: ManuscriptExportSettings) => void;
  /** The formats this destination offers (every one locally; the server's when publishing). */
  formats: readonly ManuscriptFormat[];
  /** Branching only: the gamebook's scene order is asked, and scenes are not chaptered. */
  branching: boolean;
  /** Linear with loose scenes only: when false the loose switch is hidden. */
  showLooseSwitch: boolean;
  looseCount: number;
  /** Linear only: a gamebook has a single numbering, so restarting numbers is meaningless. */
  chapterNumberingAvailable: boolean;
  /** The story's arcs; the arc selector only shows when there is more than one. */
  arcs: ManuscriptExportArc[];
  /** False when no file is made (only the online reader): the format is not asked. */
  showFormat?: boolean;
  /** Offers the chronicle preset: the work is a tabletop campaign. */
  chronicle?: boolean;
  /** For a screenplay format: how long the script is, and what that number stands on. */
  screenplayEstimate?: ScreenplayEstimate | null;
  /** For a PDF or a Word file of prose: asks for the page count; absent where it makes no sense. */
  onEstimatePages?: () => void;
  /** The page count for the settings as they are now, once asked for. */
  pageEstimate?: ManuscriptPageEstimate | null;
  /** How big the file will be, and how that stands against the limit; shown before anything is compiled. */
  sizeEstimate?: ManuscriptSizeAssessment | null;
  /** The story has music in its scenes: the export offers to write it. Absent where it cannot (a publication). */
  hasMusic?: boolean;
}

/** `12.3 MB`: one decimal, and `< 0.1 MB` for what is not worth a figure. */
function formatMegabytes(bytes: number): string {
  const megabytes = bytes / (1024 * 1024);
  return megabytes < 0.1 ? '< 0.1 MB' : `${megabytes.toFixed(1)} MB`;
}

const FONT_SIZES = [10, 11, 12, 14] as const;
const LINE_SPACINGS = [1, 1.15, 1.35, 1.5, 2] as const;
// Samples, not words: they read the same in every language.
const SAMPLES = {
  arabic: '1, 2, 3',
  roman: 'I, II, III',
  hash: '#',
  asterisks: '* * *',
  rule: '———',
  straight: '" "',
  curly: '“ ”',
  guillemets: '« »',
};

/**
 * Everything a manuscript export asks, shared by the export screen and the publish screen: a
 * preset to start from, the format, what the manuscript contains, its title page, its layout and
 * its text. An option a format cannot honor is not shown for it; any change by hand makes the
 * settings custom. Controlled: the owner keeps the settings.
 */
const ManuscriptExportOptions: React.FC<ManuscriptExportOptionsProps> = ({
  settings,
  onChange,
  formats,
  branching,
  showLooseSwitch,
  looseCount,
  chapterNumberingAvailable,
  arcs,
  showFormat = true,
  chronicle = false,
  screenplayEstimate = null,
  onEstimatePages,
  pageEstimate = null,
  sizeEstimate = null,
  hasMusic = false,
}) => {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const capabilities = FORMAT_CAPABILITIES[settings.format];
  const screenplay = isScreenplayFormat(settings.format);
  const style = settings.style;
  const change = (patch: Parameters<typeof withChange>[1]) => onChange(withChange(settings, patch));
  const changeStyle = (patch: Partial<ManuscriptStyle>) => change({ style: patch });
  const styles = StyleSheet.create({
    note: { color: colors.textSecondary, lineHeight: 19, marginTop: 4 },
    label: { color: colors.text, fontSize: 15, marginBottom: 6, marginTop: 6 },
  });

  return (
    <View>
      {screenplay ? null : (
        <>
          <OptionSection title={t('export_manuscript_preset')} />
          <OptionPills
            label={t('export_manuscript_preset_hint')}
            testID="export-preset"
            value={settings.preset}
            onChange={(preset) => {
              if (preset !== 'custom') onChange(applyPreset(settings, preset));
            }}
            options={[
              ...MANUSCRIPT_PRESETS.filter(
                (preset) =>
                  (preset !== 'chronicle' || chronicle) &&
                  formats.includes(applyPreset(settings, preset).format),
              ).map((preset) => ({
                value: preset,
                label: t(`export_manuscript_preset_${preset}`),
              })),
              { value: 'custom' as const, label: t('export_manuscript_preset_custom') },
            ]}
          />
        </>
      )}

      {arcs.length > 1 ? (
        <>
          <OptionSection title={t('export_manuscript_arc')} />
          <OptionRow
            testID="export-arc-all"
            label={t('export_manuscript_arc_all')}
            selected={settings.arcId === null}
            onPress={() => change({ arcId: null })}
          />
          {arcs.map((arc) => (
            <OptionRow
              key={arc.id}
              testID={`export-arc-${arc.id}`}
              label={arc.title}
              selected={settings.arcId === arc.id}
              onPress={() => change({ arcId: arc.id })}
            />
          ))}
        </>
      ) : null}

      {showFormat && sizeEstimate ? (
        <Text
          testID={`export-size-${sizeEstimate.status}`}
          style={[styles.note, sizeEstimate.status === 'over' ? { color: colors.error } : null]}
        >
          {t(`export_size_${sizeEstimate.status}`, {
            size: formatMegabytes(sizeEstimate.bytes),
            limit: formatMegabytes(sizeEstimate.limit),
          })}
        </Text>
      ) : null}

      {showFormat ? (
        <>
          <OptionSection title={t('export_format')} />
          {formats.map((format) => (
            <OptionRow
              key={format}
              testID={`export-format-${format}`}
              label={t(`export_manuscript_format_${format}`)}
              selected={settings.format === format}
              onPress={() => change({ format })}
            />
          ))}
        </>
      ) : null}

      {onEstimatePages && (settings.format === 'pdf' || settings.format === 'docx') ? (
        <ProsePageEstimateCard
          estimate={pageEstimate}
          onEstimate={onEstimatePages}
          isDocx={settings.format === 'docx'}
        />
      ) : null}

      {branching ? (
        <>
          <OptionSection title={t('export_manuscript_scene_order')} />
          <OptionPills
            label={t('export_manuscript_scene_order_hint')}
            testID="export-scene-order"
            value={settings.sceneOrder}
            onChange={(sceneOrder) => change({ sceneOrder })}
            options={[
              { value: 'discovery', label: t('export_manuscript_scene_order_discovery') },
              { value: 'shuffled', label: t('export_manuscript_scene_order_shuffled') },
            ]}
          />
        </>
      ) : null}

      {screenplay ? (
        <>
          <OptionSection title={t('export_screenplay_section')} />
          <OptionPills
            label={t('export_screenplay_paper')}
            testID="export-screenplay-paper"
            value={settings.screenplay.paper}
            onChange={(paper) => change({ screenplay: { paper } })}
            options={[
              { value: 'letter', label: t('export_screenplay_paper_letter') },
              { value: 'a4', label: t('export_screenplay_paper_a4') },
            ]}
          />
          <SwitchRow
            testID="export-screenplay-numbers"
            label={t('export_screenplay_number_scenes')}
            value={settings.screenplay.numberScenes}
            onChange={(numberScenes) => change({ screenplay: { numberScenes } })}
          />
          <SwitchRow
            testID="export-screenplay-headings"
            label={t('export_screenplay_generate_headings')}
            value={settings.screenplay.generateHeadings}
            onChange={(generateHeadings) => change({ screenplay: { generateHeadings } })}
          />
          <Text style={styles.note}>{t('export_screenplay_generate_headings_hint')}</Text>
          {hasMusic ? (
            <>
              <SwitchRow
                testID="export-music"
                label={t('export_screenplay_music_notes')}
                value={settings.includeMusicCues}
                onChange={(includeMusicCues) => change({ includeMusicCues })}
              />
              <Text style={styles.note}>{t('export_screenplay_music_notes_hint')}</Text>
            </>
          ) : null}
          {showLooseSwitch ? (
            <SwitchRow
              testID="export-loose"
              label={t('export_manuscript_include_loose', { count: looseCount })}
              value={settings.includeLooseScenes}
              onChange={(includeLooseScenes) => change({ includeLooseScenes })}
            />
          ) : null}
          <View>
            <Text style={styles.label}>{t('export_manuscript_author')}</Text>
            <TextInput
              testID="export-author"
              accessibilityLabel={t('export_manuscript_author')}
              value={settings.author}
              onChangeText={(author) => change({ author })}
              maxLength={200}
            />
          </View>
          {screenplayEstimate ? <ScreenplayEstimateCard estimate={screenplayEstimate} /> : null}
        </>
      ) : null}

      {screenplay ? null : (
        <>
          <OptionSection title={t('export_manuscript_contents')} />
          <SwitchRow
            testID="export-scene-names"
            label={t('export_manuscript_include_scene_names')}
            value={settings.includeSceneNames}
            onChange={(includeSceneNames) => change({ includeSceneNames })}
          />
          {settings.includeSceneNames && chapterNumberingAvailable ? (
            <SwitchRow
              testID="export-reset-numbers"
              label={t('export_manuscript_reset_numbers')}
              value={settings.resetSceneNumbers}
              onChange={(resetSceneNumbers) => change({ resetSceneNumbers })}
            />
          ) : null}
          {showLooseSwitch ? (
            <SwitchRow
              testID="export-loose"
              label={t('export_manuscript_include_loose', { count: looseCount })}
              value={settings.includeLooseScenes}
              onChange={(includeLooseScenes) => change({ includeLooseScenes })}
            />
          ) : null}
          {hasMusic ? (
            <SwitchRow
              testID="export-music"
              label={t('export_manuscript_include_music')}
              value={settings.includeMusicCues}
              onChange={(includeMusicCues) => change({ includeMusicCues })}
            />
          ) : null}
          {capabilities.index ? (
            <SwitchRow
              testID="export-index"
              label={t('export_manuscript_include_index')}
              value={settings.includeIndex}
              onChange={(includeIndex) => change({ includeIndex })}
            />
          ) : null}

          <OptionSection title={t('export_manuscript_title_page')} />
          <SwitchRow
            testID="export-title-page"
            label={t('export_manuscript_title_page_switch')}
            value={settings.titlePage}
            onChange={(titlePage) => change({ titlePage })}
          />
          {settings.titlePage || settings.format === 'epub' ? (
            <View>
              <Text style={styles.label}>{t('export_manuscript_author')}</Text>
              <TextInput
                testID="export-author"
                accessibilityLabel={t('export_manuscript_author')}
                value={settings.author}
                onChangeText={(author) => change({ author })}
                maxLength={200}
              />
            </View>
          ) : null}

          {capabilities.body || capabilities.face || capabilities.page ? (
            <OptionSection title={t('export_manuscript_layout')} />
          ) : null}
          {capabilities.page ? (
            <OptionPills
              label={t('export_manuscript_page_size')}
              testID="export-page"
              value={style.pageSize ?? 'a4'}
              onChange={(pageSize) => changeStyle({ pageSize })}
              options={[
                { value: 'a4', label: t('export_manuscript_page_a4') },
                { value: '6x9', label: t('export_manuscript_page_6x9') },
              ]}
            />
          ) : null}
          {capabilities.face ? (
            <OptionPills
              label={t('export_manuscript_font')}
              testID="export-font"
              value={style.fontFamily ?? 'serif'}
              onChange={(fontFamily) => changeStyle({ fontFamily })}
              options={[
                { value: 'serif', label: t('export_manuscript_font_serif') },
                { value: 'sans', label: t('export_manuscript_font_sans') },
              ]}
            />
          ) : null}
          {capabilities.body ? (
            <>
              <OptionPills
                label={t('export_manuscript_font_size')}
                testID="export-size"
                value={style.fontSize ?? 0}
                onChange={(fontSize) => changeStyle({ fontSize: fontSize || undefined })}
                options={[
                  { value: 0, label: t('export_manuscript_default') },
                  ...FONT_SIZES.map((size) => ({ value: size, label: `${size} pt` })),
                ]}
              />
              <OptionPills
                label={t('export_manuscript_line_spacing')}
                testID="export-spacing"
                value={style.lineSpacing ?? 0}
                onChange={(lineSpacing) => changeStyle({ lineSpacing: lineSpacing || undefined })}
                options={[
                  { value: 0, label: t('export_manuscript_default') },
                  ...LINE_SPACINGS.map((spacing) => ({ value: spacing, label: `${spacing}×` })),
                ]}
              />
              <OptionPills
                label={t('export_manuscript_paragraphs')}
                testID="export-paragraphs"
                value={style.paragraphStyle ?? 'indent'}
                onChange={(paragraphStyle) => changeStyle({ paragraphStyle })}
                options={[
                  { value: 'indent', label: t('export_manuscript_paragraphs_indent') },
                  { value: 'block', label: t('export_manuscript_paragraphs_block') },
                ]}
              />
            </>
          ) : null}

          <OptionSection title={t('export_manuscript_text')} />
          <OptionPills
            label={t('export_manuscript_numbering')}
            testID="export-numbering"
            value={style.chapterNumbering ?? 'arabic'}
            onChange={(chapterNumbering) => changeStyle({ chapterNumbering })}
            options={[
              { value: 'arabic', label: SAMPLES.arabic },
              { value: 'roman', label: SAMPLES.roman },
              { value: 'words', label: t('export_manuscript_numbering_words') },
              { value: 'none', label: t('export_manuscript_numbering_none') },
            ]}
          />
          <OptionPills
            label={t('export_manuscript_separator')}
            testID="export-separator"
            value={style.sceneSeparator ?? 'none'}
            onChange={(sceneSeparator) => changeStyle({ sceneSeparator })}
            options={[
              { value: 'none', label: t('export_manuscript_separator_none') },
              { value: 'hash', label: SAMPLES.hash },
              { value: 'asterisks', label: SAMPLES.asterisks },
              { value: 'rule', label: SAMPLES.rule },
            ]}
          />
          <OptionPills
            label={t('export_manuscript_quotes')}
            testID="export-quotes"
            value={style.quotes ?? 'straight'}
            onChange={(quotes) => changeStyle({ quotes })}
            options={[
              { value: 'straight', label: SAMPLES.straight },
              { value: 'curly', label: SAMPLES.curly },
              { value: 'guillemets', label: SAMPLES.guillemets },
            ]}
          />
          <SwitchRow
            testID="export-collapse-spaces"
            label={t('export_manuscript_collapse_spaces')}
            value={style.collapseSpaces ?? false}
            onChange={(collapseSpaces) => changeStyle({ collapseSpaces })}
          />
        </>
      )}
    </View>
  );
};

export default ManuscriptExportOptions;
