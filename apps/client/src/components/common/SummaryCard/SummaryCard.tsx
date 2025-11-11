import { Ionicons } from '@expo/vector-icons'; // Import Ionicons
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
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
      <Text style={styles.tileCount}>{count !== undefined ? count : 'N/A'}</Text>
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
    { label: t('branching'), count: branchingStories, icon: 'git-branch', color: '#FFD700' }, // gold
    { label: t('characters'), count: characterCount, icon: 'people', color: '#00C9FF' }, // light blue
    { label: t('choices'), count: choiceCount, icon: 'shuffle', color: '#FF9800' }, // orange
    { label: t('locations'), count: locationCount, icon: 'map', color: '#8BC34A' }, // light green
    { label: t('chapters'), count: chapterCount, icon: 'bookmarks', color: '#F44336' }, // red
    { label: t('scenes'), count: sceneCount, icon: 'easel', color: '#9C27B0' }, // purple
    { label: t('notes'), count: noteCount, icon: 'document', color: '#03A9F4' }, // blue
    { label: t('world_rules'), count: worldRuleCount, icon: 'globe', color: '#FFEB3B' }, // yellow
  ];

  return (
    <CollapsibleCard
      title={
        totalStories !== undefined
          ? `${t('total_stories_summary', { totalStories })}${t('branching_summary', { count: branchingStories || 0 })}`
          : title || t('summary')
      }
      initialExpanded={false}
    >
      <View style={styles.summaryGrid}>
        {tilesData.map((data, index) => {
          if (data.count !== undefined) {
            if (data.label === t('choices')) {
              return branchingStories && branchingStories > 0 ? (
                <SummaryTile
                  key={index}
                  iconName={data.icon as keyof typeof Ionicons.glyphMap}
                  label={data.label}
                  count={data.count}
                  backgroundColor={data.color}
                  textColor={colors.onPrimary}
                />
              ) : null;
            } else if (data.label === t('branching')) {
              return data.count > 0 ? (
                <SummaryTile
                  key={index}
                  iconName={data.icon as keyof typeof Ionicons.glyphMap}
                  label={data.label}
                  count={data.count}
                  backgroundColor={data.color}
                  textColor={colors.onPrimary}
                />
              ) : null;
            } else {
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
          }
          return null;
        })}
      </View>
    </CollapsibleCard>
  );
};

export default SummaryCard;
