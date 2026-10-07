import { Ionicons } from '@expo/vector-icons';
import type { ArcMedium } from '@keres/shared/metadata/ArcMedium';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import DashboardSection from '@/src/components/layout/DashboardSection/DashboardSection';
import type { StoryArcSelect } from '@/src/db/schema';
import { useTheme } from '@/src/theme';
import { useStoryVocabulary } from '@/src/vocabulary/useStoryVocabulary';

interface UniverseWorksSectionProps {
  arcs: readonly StoryArcSelect[];
  /** Opens the screen that lists and edits the works. */
  onOpenArcs: () => void;
  /** Opens one work. Without it the cards are only shown. */
  onOpenArc?: (arcId: string) => void;
  /** Starts a new work. Without it (a reader) there is no card for it. */
  onAddArc?: () => void;
}

/** What each form of work looks like at a glance. */
const MEDIUM_ICONS: Record<ArcMedium, keyof typeof Ionicons.glyphMap> = {
  generic: 'book-outline',
  screenplay: 'film-outline',
  comic: 'images-outline',
  storyboard: 'videocam-outline',
  campaign: 'dice-outline',
};

/**
 * The works of the universe, as cards: one per Arc, with the icon of its form, its name and who
 * writes it, each opening that work, and a last card to add another. The idea that a story is a
 * universe and each Arc a work inside it is said once, in a line, only while there is a single work -
 * a person with several has already understood it.
 */
const UniverseWorksSection: React.FC<UniverseWorksSectionProps> = ({
  arcs,
  onOpenArcs,
  onOpenArc,
  onAddArc,
}) => {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { term } = useStoryVocabulary();
  const arc = term('Arc');
  const arcsPlural = term('Arc', true);

  return (
    <DashboardSection
      title={t('universe_works_title', { arcs: arcsPlural })}
      action={
        <TouchableOpacity
          onPress={onOpenArcs}
          accessibilityRole="button"
          accessibilityLabel={t('universe_works_manage', { arcs: arcsPlural })}
          style={styles.manage}
        >
          <Text style={[styles.link, { color: colors.primary }]}>
            {t('universe_works_manage_short')}
          </Text>
          <Ionicons name="chevron-forward" size={16} color={colors.primary} />
        </TouchableOpacity>
      }
    >
      {arcs.length <= 1 ? (
        <Text style={[styles.intro, { color: colors.textSecondary }]}>
          {t('universe_works_intro', { arc, arcs: arcsPlural })}
        </Text>
      ) : null}
      <View style={styles.cards}>
        {arcs.map((row) => {
          const medium =
            (row.medium as ArcMedium) in MEDIUM_ICONS ? (row.medium as ArcMedium) : 'generic';
          const detail = [t(`arc_medium_${medium}`), row.author?.trim()]
            .filter(Boolean)
            .join(' · ');
          return (
            <TouchableOpacity
              key={row.id}
              testID={`universe-work-${row.id}`}
              accessibilityRole="button"
              accessibilityLabel={`${row.title}, ${detail}`}
              disabled={!onOpenArc}
              style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
              onPress={() => onOpenArc?.(row.id)}
            >
              <View style={[styles.tile, { backgroundColor: colors.primaryContainer }]}>
                <Ionicons name={MEDIUM_ICONS[medium]} size={20} color={colors.onPrimaryContainer} />
              </View>
              <View style={styles.text}>
                <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
                  {row.title}
                </Text>
                <Text style={[styles.detail, { color: colors.textSecondary }]} numberOfLines={1}>
                  {detail}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
        {onAddArc ? (
          <TouchableOpacity
            testID="universe-work-add"
            accessibilityRole="button"
            accessibilityLabel={t('universe_works_add', { arc })}
            style={[styles.card, styles.add, { borderColor: colors.primary }]}
            onPress={onAddArc}
          >
            <Ionicons name="add" size={22} color={colors.primary} />
            <Text style={[styles.name, { color: colors.primary }]} numberOfLines={1}>
              {t('universe_works_add', { arc })}
            </Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </DashboardSection>
  );
};

// The cards wrap by their own width, like the overview tiles: one column on a phone, more as the room
// grows, never wider than the screen.
const styles = StyleSheet.create({
  intro: { fontSize: 13, lineHeight: 18, marginBottom: 10, marginHorizontal: 2 },
  manage: { alignItems: 'center', flexDirection: 'row', gap: 2, minHeight: 32 },
  link: { fontSize: 14, fontWeight: '600' },
  cards: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  card: {
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    flexBasis: 240,
    flexDirection: 'row',
    flexGrow: 1,
    flexShrink: 1,
    gap: 12,
    minHeight: 60,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  add: { borderStyle: 'dashed', justifyContent: 'center' },
  tile: {
    alignItems: 'center',
    borderRadius: 10,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  text: { flexGrow: 1, flexShrink: 1 },
  name: { fontSize: 16, fontWeight: '700' },
  detail: { fontSize: 13, marginTop: 1 },
});

export default UniverseWorksSection;
