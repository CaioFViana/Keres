import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../../theme';
import { Ionicons } from '@expo/vector-icons'; // Import Ionicons

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

  const styles = StyleSheet.create({
    card: {
      marginBottom: 20,
      padding: 15,
      backgroundColor: colors.card,
      borderRadius: 8,
    },
    cardTitle: {
      fontSize: 20,
      fontWeight: 'bold',
      color: colors.text,
      marginBottom: 10,
      textAlign: 'center',
    },
    summaryGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'flex-start', // Align items to the start
      marginHorizontal: '-1%', // Counteract tile margin
    },
  });

  const tilesData = [
    { label: 'Branching', count: branchingStories, icon: 'git-branch', color: '#FFD700' }, // gold
    { label: 'Characters', count: characterCount, icon: 'people', color: '#00C9FF' }, // light blue
    { label: 'Choices', count: choiceCount, icon: 'shuffle', color: '#FF9800' }, // orange
    { label: 'Locations', count: locationCount, icon: 'map', color: '#8BC34A' }, // light green
    { label: 'Chapters', count: chapterCount, icon: 'bookmarks', color: '#F44336' }, // red
    { label: 'Scenes', count: sceneCount, icon: 'easel', color: '#9C27B0' }, // purple
    { label: 'Notes', count: noteCount, icon: 'document', color: '#03A9F4' }, // blue
    { label: 'World Rules', count: worldRuleCount, icon: 'globe', color: '#FFEB3B' }, // yellow
  ];

  return (
    <View style={styles.card}>
      {totalStories !== undefined && (
        <Text style={styles.cardTitle}>
          {totalStories} Stories {branchingStories !== undefined && branchingStories > 0 && `(${branchingStories} branching)`}
        </Text>
      )} 
      {title && totalStories === undefined && <Text style={styles.cardTitle}>{title}</Text>}

      <View style={styles.summaryGrid}>
        {tilesData.map((data, index) => {
          if (data.count !== undefined) {
            if (data.label === 'Choices') {
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
            } else if (data.label === 'Branching') {
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
    </View>
  );
};

export default SummaryCard;
