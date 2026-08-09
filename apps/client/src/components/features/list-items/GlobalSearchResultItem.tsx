import { Ionicons } from '@expo/vector-icons';
import { GlobalSearchEntityType } from '@keres/shared/metadata/globalSearchFields';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTheme } from '../../../theme';
import { GlobalSearchResult } from '../../../services/storymanagement/GlobalSearchService';

const ENTITY_ICONS: Record<GlobalSearchEntityType, keyof typeof Ionicons.glyphMap> = {
  Character: 'person-outline',
  Scene: 'film-outline',
  Location: 'location-outline',
  Item: 'cube-outline',
  ItemJourney: 'swap-horizontal-outline',
  Tag: 'pricetag-outline',
  Choice: 'git-branch-outline',
  Chapter: 'book-outline',
  Note: 'document-text-outline',
  WorldRule: 'shield-checkmark-outline',
};

interface GlobalSearchResultItemProps {
  result: GlobalSearchResult;
  onPress: (result: GlobalSearchResult) => void;
}

const GlobalSearchResultItem: React.FC<GlobalSearchResultItemProps> = ({ result, onPress }) => {
  const { colors } = useTheme();
  const styles = createStyles(colors);

  return (
    <TouchableOpacity style={styles.container} onPress={() => onPress(result)}>
      <Ionicons name={ENTITY_ICONS[result.entityType]} size={22} color={colors.primary} style={styles.icon} />
      <View style={styles.textContainer}>
        <Text style={styles.title} numberOfLines={1} ellipsizeMode="tail">
          {result.title}
        </Text>
        {!!result.snippet && (
          <Text style={styles.snippet} numberOfLines={2} ellipsizeMode="tail">
            {result.snippet}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );
};

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.surface,
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    marginHorizontal: 10,
  },
  icon: {
    marginRight: 10,
    marginTop: 2,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.text,
  },
  snippet: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
});

export default GlobalSearchResultItem;
