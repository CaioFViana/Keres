import type { ManuscriptPageEstimate } from '@keres/shared';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { ThemeColors } from '@/src/theme';
import { useThemedStyles } from '@/src/theme/useThemedStyles';
import { estimateCardStyleDefs } from './estimateCardStyles';

interface ProsePageEstimateCardProps {
  /** The count for the settings as they are now; `null` until asked for (or once they changed). */
  estimate: ManuscriptPageEstimate | null;
  onEstimate: () => void;
  /** Word re-flows its own way, so the number is said to be the PDF's. */
  isDocx?: boolean;
}

const POINTS_PER_CM = 72 / 2.54;

/**
 * The length of a prose manuscript on request and, beside the number, what it stands on: the page, the
 * font, the spacing and the margins. The count is the PDF's own layout, so the same settings give the
 * same pages - never a guess dressed as a fact.
 */
const ProsePageEstimateCard: React.FC<ProsePageEstimateCardProps> = ({
  estimate,
  onEstimate,
  isDocx = false,
}) => {
  const { t } = useTranslation();
  const styles = useThemedStyles(createStyles);
  const cm = (points: number) => (Math.round((points / POINTS_PER_CM) * 10) / 10).toString();

  return (
    <View style={styles.card} testID="prose-estimate">
      {estimate ? (
        <>
          <Text style={styles.headline} testID="prose-estimate-pages">
            {t('export_prose_estimate_pages', { count: estimate.pages })}
          </Text>
          <Text style={styles.heading}>{t('export_prose_how_title')}</Text>
          <Text style={styles.sub} testID="prose-estimate-how">
            {[
              t('export_prose_how_page', { page: t(`export_prose_page_${estimate.pageSize}`) }),
              t('export_prose_how_font', {
                size: estimate.fontSize,
                spacing: estimate.lineSpacing,
              }),
              t('export_prose_how_margins', { margin: cm(estimate.marginPt) }),
              t(
                estimate.firstLineIndentPt > 0
                  ? 'export_prose_how_indent'
                  : 'export_prose_how_block',
              ),
              t(isDocx ? 'export_prose_how_note_docx' : 'export_prose_how_note'),
            ].join('\n')}
          </Text>
        </>
      ) : (
        <Text style={styles.sub}>{t('export_prose_estimate_hint')}</Text>
      )}
      <TouchableOpacity accessibilityRole="button" testID="prose-estimate-run" onPress={onEstimate}>
        <Text style={styles.action}>
          {t(estimate ? 'export_prose_estimate_again' : 'export_prose_estimate_run')}
        </Text>
      </TouchableOpacity>
    </View>
  );
};

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    ...estimateCardStyleDefs(colors),
    action: { color: colors.primary, fontWeight: '700' },
  });

export default ProsePageEstimateCard;
