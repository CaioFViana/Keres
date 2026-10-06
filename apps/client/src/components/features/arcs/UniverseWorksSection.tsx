import ScreenSection from '@/src/components/layout/ScreenSection/ScreenSection';
import type { StoryArcSelect } from '@/src/db/schema';
import { useTheme } from '@/src/theme';
import { useStoryVocabulary } from '@/src/vocabulary/useStoryVocabulary';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface UniverseWorksSectionProps {
  arcs: readonly StoryArcSelect[];
  /** Opens the screen that lists and edits the works. */
  onOpenArcs: () => void;
}

/**
 * The first place a person meets the idea that a story is a universe and each Arc a work inside it
 * (a book, a film, an issue, a season). Says it in plain words and lists the works with their form.
 */
const UniverseWorksSection: React.FC<UniverseWorksSectionProps> = ({ arcs, onOpenArcs }) => {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { term } = useStoryVocabulary();
  const arc = term('Arc');
  const arcsPlural = term('Arc', true);

  return (
    <ScreenSection
      title={t('universe_works_title', { arcs: arcsPlural })}
      actions={
        <TouchableOpacity
          onPress={onOpenArcs}
          accessibilityRole="button"
          accessibilityLabel={t('universe_works_manage', { arcs: arcsPlural })}
        >
          <Text style={[styles.link, { color: colors.primary }]}>
            {t('universe_works_manage', { arcs: arcsPlural })}
          </Text>
        </TouchableOpacity>
      }
    >
      <Text style={[styles.intro, { color: colors.textSecondary }]}>
        {t('universe_works_intro', { arc, arcs: arcsPlural })}
      </Text>
      {arcs.map((row) => (
        <View key={row.id} style={[styles.row, { borderColor: colors.border }]}>
          <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
            {row.title}
          </Text>
          <Text style={{ color: colors.textSecondary }}>
            {t(`arc_medium_${row.medium}`)}
            {row.author?.trim() ? ` · ${row.author.trim()}` : ''}
          </Text>
        </View>
      ))}
    </ScreenSection>
  );
};

const styles = StyleSheet.create({
  intro: { lineHeight: 20, marginBottom: 10 },
  link: { fontSize: 14, fontWeight: '600' },
  row: { borderTopWidth: StyleSheet.hairlineWidth, gap: 2, paddingVertical: 9 },
  name: { fontSize: 16, fontWeight: '600' },
});

export default UniverseWorksSection;
