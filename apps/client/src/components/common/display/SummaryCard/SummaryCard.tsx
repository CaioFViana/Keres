import { Ionicons } from '@expo/vector-icons'; // Import Ionicons
import { getContrastTextColor, getEntityAppearance } from '@keres/shared';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTheme } from '../../../../theme';
import { useStoryVocabulary } from '../../../../vocabulary/useStoryVocabulary';

interface AnalysisSummaryBannerProps {
  issueCount: number;
  onPress: () => void;
}

/**
 * A tappable line at the top of the card, summarising the structural analysis report (see
 * `StoryAnalysisService`) - the same colour convention as `NotificationItem` (error/primary).
 */
const AnalysisSummaryBanner: React.FC<AnalysisSummaryBannerProps> = ({ issueCount, onPress }) => {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const hasIssues = issueCount > 0;

  const styles = StyleSheet.create({
    banner: {
      flexDirection: 'row',
      alignItems: 'center',
      borderRadius: 8,
      padding: 12,
      marginBottom: 10,
      backgroundColor: hasIssues ? colors.error : colors.primary,
    },
    text: {
      flex: 1,
      marginLeft: 10,
      fontSize: 14,
      fontWeight: 'bold',
      color: colors.onPrimary,
    },
  });

  return (
    <TouchableOpacity style={styles.banner} onPress={onPress} activeOpacity={0.8}>
      <Ionicons
        name={hasIssues ? 'warning-outline' : 'checkmark-circle-outline'}
        size={22}
        color={colors.onPrimary}
      />
      <Text style={styles.text}>
        {hasIssues
          ? t('story_analysis_issues_found', { count: issueCount })
          : t('story_analysis_no_issues')}
      </Text>
      <Ionicons name="chevron-forward" size={20} color={colors.onPrimary} />
    </TouchableOpacity>
  );
};

interface SummaryTileProps {
  iconName: keyof typeof Ionicons.glyphMap;
  label: string;
  count: number | string | undefined;
  /** The colour of the kind of thing counted, used on the icon only. */
  accent: string;
}

/** One count on one line: a small coloured icon, the number and what it counts. Never taller than a finger. */
const SummaryTile: React.FC<SummaryTileProps> = ({ iconName, label, count, accent }) => {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const onAccent = getContrastTextColor(accent);
  return (
    <View style={[styles.tile, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={[styles.tileIcon, { backgroundColor: accent }]}>
        <Ionicons name={iconName} size={16} color={onAccent} />
      </View>
      <Text style={[styles.tileCount, { color: colors.text }]}>
        {count !== undefined ? count : t('common_na')}
      </Text>
      <Text style={[styles.tileLabel, { color: colors.textSecondary }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
};

interface SummaryCardProps {
  totalStories?: number;
  branchingStories?: number;
  characterCount?: number;
  choiceCount?: number;
  locationCount?: number;
  chapterCount?: number;
  sceneCount?: number;
  noteCount?: number;
  worldRuleCount?: number;
  itemCount?: number;
  galleryCount?: number;
  tagCount?: number;
  customAttributeCount?: number;
  branchingStoryForkCount?: number; // New prop for the count of forks in branching stories
  isBranchingStory?: boolean; // New prop to indicate if the summary is for a single branching story
  title?: string; // Optional title for the card, e.g., "Global Summary" or "Story Summary"
  /** When present, it shows the structural analysis report's summary above the grid. */
  analysisSummary?: { issueCount: number; onPress: () => void };
}

const SummaryCard: React.FC<SummaryCardProps> = ({
  totalStories,
  branchingStories,
  characterCount,
  choiceCount,
  locationCount,
  chapterCount,
  sceneCount,
  noteCount,
  worldRuleCount,
  itemCount,
  galleryCount,
  tagCount,
  customAttributeCount,
  branchingStoryForkCount,
  isBranchingStory, // Destructure new prop
  title,
  analysisSummary,
}) => {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { term } = useStoryVocabulary();
  const [expanded, setExpanded] = React.useState(false);

  const tilesData = [
    { label: term('Chapter', true), count: chapterCount, ...getEntityAppearance('Chapter') },
    { label: term('Scene', true), count: sceneCount, ...getEntityAppearance('Scene') },
    { label: term('Location', true), count: locationCount, ...getEntityAppearance('Location') },
    { label: term('Character', true), count: characterCount, ...getEntityAppearance('Character') },
    { label: t('notes'), count: noteCount, ...getEntityAppearance('Note') },
    { label: term('WorldRule', true), count: worldRuleCount, ...getEntityAppearance('WorldRule') },
    { label: term('Item', true), count: itemCount, ...getEntityAppearance('Item') },
    { label: t('gallery'), count: galleryCount, ...getEntityAppearance('Gallery') },
    { label: t('tags_title'), count: tagCount, ...getEntityAppearance('Tag') },
    {
      label: t('custom_attributes'),
      count: customAttributeCount,
      ...getEntityAppearance('StorySchemaField'),
    },
  ];

  // Add "Forks" and "Choices" tiles if it's a branching story or if there are multiple branching stories.
  // The specific tile will only render if its count is provided and not undefined.
  if (isBranchingStory || (branchingStories && branchingStories > 0)) {
    tilesData.unshift({
      label: term('Choice', true),
      count: choiceCount,
      ...getEntityAppearance('Choice'),
    });
    tilesData.unshift({
      label: t('forks'),
      count: branchingStoryForkCount,
      ...getEntityAppearance('Fork'),
    });
  }

  return (
    <View>
      {analysisSummary && (
        <AnalysisSummaryBanner
          issueCount={analysisSummary.issueCount}
          onPress={analysisSummary.onPress}
        />
      )}
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityState={{ expanded }}
          style={styles.header}
          onPress={() => setExpanded((open) => !open)}
        >
          <Text style={[styles.title, { color: colors.text }]} numberOfLines={2}>
            {totalStories !== undefined
              ? `${t('total_stories_summary', { totalStories })} - ${t('branching_summary', { count: branchingStories || 0 })}`
              : title || t('summary')}
          </Text>
          <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={22} color={colors.text} />
        </TouchableOpacity>
        {expanded ? (
          <View style={styles.tiles}>
            {tilesData.map((data, index) =>
              data.count !== undefined ? (
                <SummaryTile
                  key={index}
                  iconName={data.icon as keyof typeof Ionicons.glyphMap}
                  label={data.label}
                  count={data.count}
                  accent={data.color}
                />
              ) : null,
            )}
          </View>
        ) : null}
      </View>
    </View>
  );
};

// Tiles wrap by their own width instead of a fixed number of columns: two on a phone, more as the room
// grows, and never wider than the card - there is nothing to push the screen sideways.
const styles = StyleSheet.create({
  card: { borderRadius: 12, borderWidth: 1, marginBottom: 10, overflow: 'hidden' },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'space-between',
    minHeight: 48,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  title: { flexShrink: 1, fontSize: 16, fontWeight: '700' },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, padding: 12, paddingTop: 0 },
  tile: {
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1,
    flexBasis: 140,
    flexDirection: 'row',
    flexGrow: 1,
    flexShrink: 1,
    gap: 8,
    minHeight: 44,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  tileIcon: {
    alignItems: 'center',
    borderRadius: 7,
    height: 26,
    justifyContent: 'center',
    width: 26,
  },
  tileCount: { fontSize: 16, fontWeight: '700' },
  tileLabel: { flexShrink: 1, fontSize: 13 },
});

export default SummaryCard;
