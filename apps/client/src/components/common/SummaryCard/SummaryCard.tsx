import { Ionicons } from '@expo/vector-icons'; // Import Ionicons
import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../../theme';
import CollapsibleCard from '../CollapsibleCard/CollapsibleCard'; // Import CollapsibleCard

interface SummaryTileProps {
  iconName: keyof typeof Ionicons.glyphMap; // Type for icon names
  label: string;
  count: number | string | undefined;
  backgroundColor: string;
  textColor: string;
}

const SummaryTile: React.FC<SummaryTileProps> = ({
  iconName, label, count, backgroundColor, textColor,
}) => {
  const { t } = useTranslation(); // Add useTranslation here
  const styles = StyleSheet.create({
    tile: {
      width: '48%', // Roughly half width for two columns
      padding: 10,
      marginVertical: 5,
      marginHorizontal: '1%',
      borderRadius: 8,
      backgroundColor,
      alignItems: 'center',
      justifyContent: 'center',
    },
    tileText: {
      fontSize: 14,
      fontWeight: 'bold',
      color: textColor,
      marginTop: 5,
      textAlign: 'center',
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
  branchingStoryForkCount?: number; // New prop for the count of forks in branching stories
  isBranchingStory?: boolean; // New prop to indicate if the summary is for a single branching story
  title?: string; // Optional title for the card, e.g., "Global Summary" or "Story Summary"
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
  branchingStoryForkCount,
  isBranchingStory, // Destructure new prop
  title,
}) => {
  const { colors } = useTheme();
  const { t } = useTranslation();

  const styles = StyleSheet.create({
    summaryGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'flex-start', // Align items to the start
      marginHorizontal: '-1%', // Counteract tile margin
    },
  });

  const tilesData = [
    { label: t('chapters'), count: chapterCount, icon: 'bookmarks', color: '#F44336' }, // red
    { label: t('scenes'), count: sceneCount, icon: 'easel', color: '#a13fb3ff' }, // purple
    { label: t('locations'), count: locationCount, icon: 'map', color: '#8BC34A' }, // light green
    { label: t('characters'), count: characterCount, icon: 'people', color: '#37afa5ff' }, // light blue
    { label: t('notes'), count: noteCount, icon: 'document', color: '#FFEB3B' }, // yellow
    { label: t('world_rules'), count: worldRuleCount, icon: 'globe', color: '#03A9F4' }, // blue
    { label: t('items'), count: itemCount, icon: 'cube', color: '#795548' }, // brown
    { label: t('gallery'), count: galleryCount, icon: 'images', color: '#009688' }, // teal
  ];

  // Add "Forks" and "Choices" tiles if it's a branching story or if there are multiple branching stories.
  // The specific tile will only render if its count is provided and not undefined.
  if (isBranchingStory || (branchingStories && branchingStories > 0)) {
    tilesData.unshift({ label: t('choices'), count: choiceCount, icon: 'shuffle', color: '#FF9800' }); // orange
    tilesData.unshift({ label: t('forks'), count: branchingStoryForkCount, icon: 'git-branch', color: '#FFD700' }); // gold
  }

  return (
    <CollapsibleCard
      title={
        totalStories !== undefined
          ? `${t('total_stories_summary', { totalStories })} - ${t('branching_summary', { count: branchingStories || 0 })}`
          : title || t('summary')
      }
      initialExpanded={false}
    >
      <View style={styles.summaryGrid}>
        {tilesData.map((data, index) => {
          if (data.count !== undefined) {
            return (
              <SummaryTile
                key={index}
                iconName={data.icon as keyof typeof Ionicons.glyphMap}
                label={data.label}
                count={data.count}
                backgroundColor={data.color}
                textColor={colors.onPrimary}
              />
            );
          }
          return null;
        })}
      </View>
    </CollapsibleCard>
  );
};

export default SummaryCard;