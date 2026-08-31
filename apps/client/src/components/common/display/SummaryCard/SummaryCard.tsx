import { Ionicons } from '@expo/vector-icons'; // Import Ionicons
import { getContrastTextColor, getEntityAppearance } from '@keres/shared';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTheme } from '../../../../theme';
import { useStoryVocabulary } from '../../../../vocabulary/useStoryVocabulary';
import CollapsibleCard from '@/src/components/common/display/CollapsibleCard/CollapsibleCard'; // Import CollapsibleCard
import ResponsiveGrid from '@/src/components/layout/ResponsiveGrid/ResponsiveGrid';

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
  iconName: keyof typeof Ionicons.glyphMap; // Type for icon names
  label: string;
  count: number | string | undefined;
  backgroundColor: string;
  textColor: string;
}

const SummaryTile: React.FC<SummaryTileProps> = ({
  iconName,
  label,
  count,
  backgroundColor,
  textColor,
}) => {
  const { t } = useTranslation(); // Add useTranslation here
  const styles = StyleSheet.create({
    tile: {
      padding: 10,
      marginVertical: 5,
      borderRadius: 8,
      backgroundColor,
      alignItems: 'center',
      justifyContent: 'center',
    },
    tileText: {
      fontSize: 14,
      lineHeight: 18,
      minHeight: 36,
      fontWeight: 'bold',
      color: textColor,
      marginTop: 5,
      textAlign: 'center',
      textAlignVertical: 'center',
    },
    tileCount: {
      fontSize: 18,
      fontWeight: 'bold',
      color: textColor,
    },
  });

  return (
    <View style={styles.tile}>
      <Ionicons name={iconName} size={24} color={textColor} />
      <Text style={styles.tileCount}>{count !== undefined ? count : t('common_na')}</Text>
      <Text style={styles.tileText}>{label}</Text>
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
  const { term } = useStoryVocabulary();

  const tilesData = [
    { label: term('Chapter', true), count: chapterCount, ...getEntityAppearance('Chapter') },
    { label: term('Scene', true), count: sceneCount, ...getEntityAppearance('Scene') },
    { label: term('Location', true), count: locationCount, ...getEntityAppearance('Location') },
    { label: term('Character', true), count: characterCount, ...getEntityAppearance('Character') },
    { label: t('notes'), count: noteCount, ...getEntityAppearance('Note') },
    { label: t('world_rules'), count: worldRuleCount, ...getEntityAppearance('WorldRule') },
    { label: t('items'), count: itemCount, ...getEntityAppearance('Item') },
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
      label: t('choices'),
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
      <CollapsibleCard
        title={
          totalStories !== undefined
            ? `${t('total_stories_summary', { totalStories })} - ${t('branching_summary', { count: branchingStories || 0 })}`
            : title || t('summary')
        }
        initialExpanded={false}
      >
        <ResponsiveGrid compactColumns={2} mediumColumns={3} wideColumns={5} gap={10}>
          {tilesData.map((data, index) => {
            if (data.count !== undefined) {
              return (
                <SummaryTile
                  key={index}
                  iconName={data.icon as keyof typeof Ionicons.glyphMap}
                  label={data.label}
                  count={data.count}
                  backgroundColor={data.color}
                  textColor={getContrastTextColor(data.color)}
                />
              );
            }
            return null;
          })}
        </ResponsiveGrid>
      </CollapsibleCard>
    </View>
  );
};

export default SummaryCard;
