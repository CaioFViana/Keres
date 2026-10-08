import { Ionicons } from '@expo/vector-icons';
import { getContrastTextColor, getEntityAppearance } from '@keres/shared';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import DashboardSection from '@/src/components/layout/DashboardSection/DashboardSection';
import { useTheme } from '../../../../theme';
import { useStoryVocabulary } from '../../../../vocabulary/useStoryVocabulary';

interface AnalysisChipProps {
  issueCount: number;
  onPress: () => void;
}

/**
 * The structural analysis report in a word: a small pill, calm when the story is clean and in the
 * error colour when it is not, which opens the report. (The report itself is `StoryAnalysisService`.)
 */
const AnalysisChip: React.FC<AnalysisChipProps> = ({ issueCount, onPress }) => {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const hasIssues = issueCount > 0;
  const tone = hasIssues ? colors.error : colors.onPrimaryContainer;
  return (
    <TouchableOpacity
      accessibilityRole="button"
      onPress={onPress}
      activeOpacity={0.8}
      style={[
        styles.chip,
        { backgroundColor: hasIssues ? `${colors.error}1f` : colors.primaryContainer },
      ]}
    >
      <Ionicons
        name={hasIssues ? 'warning-outline' : 'checkmark-circle-outline'}
        size={16}
        color={tone}
      />
      <Text style={[styles.chipText, { color: tone }]} numberOfLines={1}>
        {hasIssues
          ? t('story_analysis_issues_found', { count: issueCount })
          : t('story_analysis_no_issues')}
      </Text>
      <Ionicons name="chevron-forward" size={14} color={tone} />
    </TouchableOpacity>
  );
};

interface SummaryTileProps {
  iconName: keyof typeof Ionicons.glyphMap;
  label: string;
  count: number | string | undefined;
  /** The colour of the kind of thing counted, used on the icon only. */
  accent: string;
  /** The tile's width once the grid knows how many fit; before that it takes what it can. */
  width?: number;
}

/** The least a tile is wide, and the gap between tiles. */
const TILE_MIN_WIDTH = 100;
const TILE_GAP = 8;

/** One count: a small coloured icon beside the number, and what it counts under them. */
const SummaryTile: React.FC<SummaryTileProps> = ({ iconName, label, count, accent, width }) => {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const onAccent = getContrastTextColor(accent);
  const none = count === 0;
  return (
    <View
      style={[
        styles.tile,
        width ? { width, flexBasis: width, flexGrow: 0 } : null,
        { backgroundColor: colors.surface, borderColor: colors.border },
      ]}
    >
      <View style={styles.tileTop}>
        <View style={[styles.tileIcon, { backgroundColor: accent, opacity: none ? 0.45 : 1 }]}>
          <Ionicons name={iconName} size={15} color={onAccent} />
        </View>
        <Text style={[styles.tileCount, { color: none ? colors.textSecondary : colors.text }]}>
          {count !== undefined ? count : t('common_na')}
        </Text>
      </View>
      <Text style={[styles.tileLabel, { color: colors.textSecondary }]} numberOfLines={2}>
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
  plotCount?: number;
  boardCount?: number;
  branchingStoryForkCount?: number; // New prop for the count of forks in branching stories
  isBranchingStory?: boolean; // New prop to indicate if the summary is for a single branching story
  title?: string; // Optional title for the card, e.g., "Global Summary" or "Story Summary"
  /** When present, it shows the structural analysis report's summary beside the title. */
  analysisSummary?: { issueCount: number; onPress: () => void };
  /**
   * `card` folds the counts under a title that opens them (the stories list); `section` is a block of
   * the story's home, always open, with the analysis status at the end of its heading.
   */
  layout?: 'card' | 'section';
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
  plotCount,
  boardCount,
  branchingStoryForkCount,
  isBranchingStory, // Destructure new prop
  title,
  analysisSummary,
  layout = 'card',
}) => {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { term } = useStoryVocabulary();
  const [expanded, setExpanded] = React.useState(false);
  // The tiles fill each row exactly: as many as fit at least TILE_MIN_WIDTH wide, all the same width, so
  // the last row is a shorter row of the same tiles instead of a few stretched ones.
  const [gridWidth, setGridWidth] = React.useState(0);
  const columns = Math.max(1, Math.floor((gridWidth + TILE_GAP) / (TILE_MIN_WIDTH + TILE_GAP)));
  const tileWidth =
    gridWidth > 0 ? Math.floor((gridWidth - TILE_GAP * (columns - 1)) / columns) : undefined;

  // Twelve counts, so the grid divides evenly into two, three, four or six columns as the window
  // resizes. A branching story swaps the two that describe the story's organisation (tags and custom
  // fields) for the two that describe its branching (forks and choices): the number stays twelve.
  const branching = isBranchingStory || (branchingStories && branchingStories > 0);
  const tilesData = [
    {
      key: 'chapters',
      label: term('Chapter', true),
      count: chapterCount,
      ...getEntityAppearance('Chapter'),
    },
    {
      key: 'scenes',
      label: term('Scene', true),
      count: sceneCount,
      ...getEntityAppearance('Scene'),
    },
    { key: 'plots', label: t('plots_title'), count: plotCount, ...getEntityAppearance('Plot') },
    {
      key: 'locations',
      label: term('Location', true),
      count: locationCount,
      ...getEntityAppearance('Location'),
    },
    {
      key: 'characters',
      label: term('Character', true),
      count: characterCount,
      ...getEntityAppearance('Character'),
    },
    { key: 'notes', label: t('notes'), count: noteCount, ...getEntityAppearance('Note') },
    {
      key: 'world',
      label: term('WorldRule', true),
      count: worldRuleCount,
      ...getEntityAppearance('WorldRule'),
    },
    { key: 'items', label: term('Item', true), count: itemCount, ...getEntityAppearance('Item') },
    { key: 'gallery', label: t('gallery'), count: galleryCount, ...getEntityAppearance('Gallery') },
    { key: 'boards', label: t('boards_title'), count: boardCount, ...getEntityAppearance('Board') },
    ...(branching
      ? [
          {
            key: 'forks',
            label: t('forks'),
            count: branchingStoryForkCount,
            ...getEntityAppearance('Fork'),
          },
          {
            key: 'choices',
            label: term('Choice', true),
            count: choiceCount,
            ...getEntityAppearance('Choice'),
          },
        ]
      : [
          { key: 'tags', label: t('tags_title'), count: tagCount, ...getEntityAppearance('Tag') },
          {
            key: 'attributes',
            label: t('custom_attributes'),
            count: customAttributeCount,
            ...getEntityAppearance('StorySchemaField'),
          },
        ]),
  ];

  const tiles = (
    <View style={styles.tiles} onLayout={(event) => setGridWidth(event.nativeEvent.layout.width)}>
      {tilesData.map((data) =>
        data.count !== undefined ? (
          <SummaryTile
            key={data.key}
            iconName={data.icon as keyof typeof Ionicons.glyphMap}
            label={data.label}
            count={data.count}
            accent={data.color}
            width={tileWidth}
          />
        ) : null,
      )}
    </View>
  );
  const chip = analysisSummary ? (
    <AnalysisChip issueCount={analysisSummary.issueCount} onPress={analysisSummary.onPress} />
  ) : null;

  if (layout === 'section') {
    return (
      <DashboardSection title={title || t('summary')} action={chip}>
        {tiles}
      </DashboardSection>
    );
  }

  return (
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
      {chip ? <View style={styles.cardChip}>{chip}</View> : null}
      {expanded ? <View style={styles.cardTiles}>{tiles}</View> : null}
    </View>
  );
};

// Tiles wrap by their own width instead of a fixed number of columns: three on a phone, more as the
// room grows, and never wider than the container - there is nothing to push the screen sideways.
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
  cardChip: { alignItems: 'flex-start', paddingBottom: 10, paddingHorizontal: 14 },
  cardTiles: { padding: 12, paddingTop: 0 },
  chip: {
    alignItems: 'center',
    borderRadius: 14,
    flexDirection: 'row',
    gap: 5,
    minHeight: 28,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  chipText: { fontSize: 13, fontWeight: '700' },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: TILE_GAP },
  tile: {
    borderRadius: 12,
    borderWidth: 1,
    flexBasis: 100,
    flexGrow: 1,
    flexShrink: 1,
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  tileTop: { alignItems: 'center', flexDirection: 'row', gap: 8 },
  tileIcon: {
    alignItems: 'center',
    borderRadius: 8,
    height: 26,
    justifyContent: 'center',
    width: 26,
  },
  tileCount: { fontSize: 20, fontWeight: '700' },
  tileLabel: { fontSize: 12 },
});

export default SummaryCard;
