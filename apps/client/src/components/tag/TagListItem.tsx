import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { TagSelect } from '../../db/schemas/tags'; // Corrected import path
import { useTheme } from '../../theme';

interface TagListItemProps {
  tag: TagSelect;
  onViewDetails: (tagId: string) => void;
  // onToggleFavorite?: (tagId: string, isFavorite: boolean) => void; // If tags can be favorited
}

const TagListItem: React.FC<TagListItemProps> = ({ tag, onViewDetails }) => {
  const { colors } = useTheme();

  const styles = StyleSheet.create({
    container: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: 15,
      marginVertical: 5,
      borderRadius: 8,
      backgroundColor: colors.surface,
      shadowColor: colors.textSecondary,
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.2,
      shadowRadius: 1.41,
      elevation: 2,
    },
    tagInfo: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
    },
    tagColorIndicator: {
      width: 20,
      height: 20,
      borderRadius: 10,
      marginRight: 10,
      borderWidth: 1,
      borderColor: colors.border,
    },
    tagName: {
      fontSize: 18,
      fontWeight: 'bold',
      color: colors.text,
      flexShrink: 1,
    },
    // favoriteButton: {
    //   padding: 5,
    // },
  });

  return (
    <TouchableOpacity onPress={() => onViewDetails(tag.id)} style={styles.container}>
      <View style={styles.tagInfo}>
        {tag.color && <View style={[styles.tagColorIndicator, { backgroundColor: tag.color }]} />}
        <Text style={styles.tagName} numberOfLines={1}>
          {tag.name}
        </Text>
      </View>
      {/* {onToggleFavorite && (
        <TouchableOpacity onPress={() => onToggleFavorite(tag.id, !tag.isFavorite)} style={styles.favoriteButton}>
          <Ionicons
            name={tag.isFavorite ? 'heart' : 'heart-outline'}
            size={24}
            color={tag.isFavorite ? colors.accent : colors.textSecondary}
          />
        </TouchableOpacity>
      )} */}
    </TouchableOpacity>
  );
};

export default TagListItem;