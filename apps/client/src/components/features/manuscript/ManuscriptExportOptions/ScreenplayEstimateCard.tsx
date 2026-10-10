import { type ScreenplayEstimate, formatEighths } from '@keres/shared';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import type { ThemeColors } from '@/src/theme';
import { typography } from '@/src/theme/tokens';
import { useThemedStyles } from '@/src/theme/useThemedStyles';

interface ScreenplayEstimateCardProps {
  estimate: ScreenplayEstimate;
}

/**
 * The length of the script and, always beside it, what that number stands on: the paper, the font,
 * the margins and the indents. Printing with the same ones gives the same pages - the estimate is
 * made by the very layout that draws the PDF - so nothing here is a guess dressed as a fact.
 */
const ScreenplayEstimateCard: React.FC<ScreenplayEstimateCardProps> = ({ estimate }) => {
  const { t } = useTranslation();
  const { preset, geometry } = estimate;
  const inches = (value: number) => value.toFixed(value % 1 === 0 ? 0 : 2).replace(/\.?0+$/, '');
  const styles = useThemedStyles(createStyles);

  return (
    <View style={styles.card} testID="screenplay-estimate">
      <Text style={styles.headline} testID="screenplay-estimate-pages">
        {t('export_screenplay_estimate_pages', { count: estimate.pages })}
      </Text>
      <Text style={styles.sub}>
        {t('export_screenplay_estimate_eighths', { eighths: formatEighths(estimate.eighths) })}
      </Text>
      <Text style={styles.heading}>{t('export_screenplay_how_title')}</Text>
      <Text style={styles.sub} testID="screenplay-estimate-how">
        {[
          t('export_screenplay_how_paper', {
            paper: t(`export_screenplay_paper_${preset.paper}`),
          }),
          t('export_screenplay_how_font', {
            font: preset.font,
            size: preset.fontSizePt,
            cpi: preset.charactersPerInch,
            lpi: preset.linesPerInch,
          }),
          t('export_screenplay_how_margins', {
            left: inches(preset.marginLeftIn),
            right: inches(preset.marginRightIn),
            top: inches(preset.marginTopIn),
            bottom: inches(preset.marginBottomIn),
          }),
          t('export_screenplay_how_page', {
            lines: geometry.linesPerPage,
            columns: geometry.actionColumns,
          }),
          t('export_screenplay_how_indents', {
            action: inches(preset.indentIn.action),
            dialogue: inches(preset.indentIn.dialogue),
            parenthetical: inches(preset.indentIn.parenthetical),
            character: inches(preset.indentIn.character),
          }),
          t('export_screenplay_how_note'),
        ].join('\n')}
      </Text>
    </View>
  );
};

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    card: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 8,
      borderWidth: 1,
      gap: 4,
      marginTop: 12,
      padding: 12,
    },
    headline: { ...typography.title, color: colors.text },
    sub: { color: colors.textSecondary, lineHeight: 19 },
    heading: { color: colors.text, fontWeight: '700', marginTop: 8 },
  });

export default ScreenplayEstimateCard;
