import {
  ARC_MEDIUM_TERMS,
  type ArcMedium,
  isArcMedium,
  type ArcMediumLanguage,
} from '@keres/shared/metadata/ArcMedium';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/src/theme';

interface ArcMediumChangesProps {
  medium: ArcMedium;
  /** The words of the interface: the medium's terms are shown in this language. */
  language: ArcMediumLanguage;
  /** Leave out the list of what else the form of the work changes (the vocabulary screen has no use for it). */
  termsOnly?: boolean;
}

/**
 * What choosing a form of work does, in plain words: the nouns it renames (against the app's own),
 * and the things it turns on. The nouns come from the same table the app resolves them with, so
 * this can never say one thing and do another.
 */
const ArcMediumChanges: React.FC<ArcMediumChangesProps> = ({
  medium,
  language,
  termsOnly = false,
}) => {
  const { t } = useTranslation();
  const { colors } = useTheme();
  // A row from before the form of the work existed has none: it is a plain one.
  const known = isArcMedium(medium) ? medium : 'generic';
  const table = ARC_MEDIUM_TERMS[known][language];
  const renamed = [
    table.Arc ? t('arc_medium_changes_term', { from: t('arc'), to: table.Arc.singular }) : null,
    table.Chapter
      ? t('arc_medium_changes_term', { from: t('chapter'), to: table.Chapter.singular })
      : null,
  ].filter((line): line is string => line !== null);

  return (
    <View style={styles.container} testID="arc-medium-changes">
      <Text style={[styles.title, { color: colors.text }]}>{t('arc_medium_changes_title')}</Text>
      <Text style={[styles.line, { color: colors.textSecondary }]} testID="arc-medium-terms">
        {renamed.length > 0
          ? t('arc_medium_changes_words', { terms: renamed.join('; ') })
          : t('arc_medium_changes_no_words')}
      </Text>
      {termsOnly ? null : (
        <Text style={[styles.line, { color: colors.textSecondary }]} testID="arc-medium-effects">
          {t(`arc_medium_${known}_changes`)}
        </Text>
      )}
      <Text style={[styles.line, { color: colors.textSecondary }]}>
        {t('arc_medium_changes_yours_win')}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { gap: 4, marginTop: 6 },
  title: { fontSize: 13, fontWeight: '700' },
  line: { fontSize: 13, lineHeight: 18 },
});

export default ArcMediumChanges;
