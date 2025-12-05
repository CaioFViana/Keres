import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { CharacterWithTags } from '../../services/CharacterService'; // Import CharacterWithTags
import { useTheme } from '../../theme'; // Adjust path as needed
import { isValidHexColor, getContrastTextColor } from '../../utils/colorUtils'; // Import color utilities
import { MaterialCommunityIcons } from '@expo/vector-icons'; // Import MaterialCommunityIcons

interface CharacterListItemProps {
  character: CharacterWithTags; // Use CharacterWithTags
  onToggleFavorite: (characterId: string, isFavorite: boolean) => void;
}

const CharacterListItem: React.FC<CharacterListItemProps> = ({ character, onToggleFavorite }) => {
  const { colors } = useTheme();

  const styles = StyleSheet.create({
    container: {
      padding: 10,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      backgroundColor: colors.card,
      marginVertical: 4,
      borderRadius: 8,
      flexDirection: 'row', // Added for favorite button positioning
      justifyContent: 'space-between', // Added for favorite button positioning
      alignItems: 'center', // Added for favorite button positioning
    },
    content: {
      flex: 1, // Added to allow content to take available space
    },
    name: {
      color: colors.text,
      fontSize: 18,
      fontWeight: 'bold',
    },
    description: {
      color: colors.textSecondary,
      fontSize: 14,
      marginTop: 4,
    },
    tagContainer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      marginTop: 8,
    },
    tag: {
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 5,
      marginRight: 5,
      marginBottom: 5,
      fontSize: 12,
    },
    favoriteButton: {
      padding: 5,
    },
  });

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.name}>{character.name}</Text>
        {character.description && <Text style={styles.description}>{character.description}</Text>}
        {character.tags && character.tags.length > 0 && (
          <View style={styles.tagContainer}>
            {character.tags.map(tag => {
              const tagColorFromDb = tag.color;
              const tagBackgroundColor = (tagColorFromDb && isValidHexColor(tagColorFromDb)) ? tagColorFromDb : colors.surface;
              const tagTextColor = getContrastTextColor(tagBackgroundColor);

              return (
                <Text key={tag.id} style={[styles.tag, { backgroundColor: tagBackgroundColor, color: tagTextColor }]}>
                  {tag.name}
                </Text>
              );
            })}
          </View>
        )}
      </View>
      <TouchableOpacity
        onPress={() => onToggleFavorite(character.id, !character.isFavorite)}
        style={styles.favoriteButton}
      >
        <MaterialCommunityIcons
          name={character.isFavorite ? 'star' : 'star-outline'}
          size={24}
          color={character.isFavorite ? colors.primary : colors.textSecondary}
        />
      </TouchableOpacity>
    </View>
  );
};

export default CharacterListItem;
