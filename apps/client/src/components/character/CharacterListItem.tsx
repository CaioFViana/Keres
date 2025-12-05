import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { CharacterWithTags } from '../../services/CharacterService'; // Import CharacterWithTags
import { useTheme } from '../../theme'; // Adjust path as needed
import { isValidHexColor, getContrastTextColor } from '../../utils/colorUtils'; // Import color utilities

interface CharacterListItemProps {
  character: CharacterWithTags; // Use CharacterWithTags
}

const CharacterListItem: React.FC<CharacterListItemProps> = ({ character }) => {
  const { colors } = useTheme();

  const styles = StyleSheet.create({
    container: {
      padding: 10,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      backgroundColor: colors.card,
      marginVertical: 4,
      borderRadius: 8,
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
  });

  return (
    <View style={styles.container}>
      <Text style={styles.name}>{character.name}</Text>
      {character.description && <Text style={styles.description}>{character.description}</Text>}
      {character.tags && character.tags.length > 0 && (
        <View style={styles.tagContainer}>
          {character.tags.map(tag => {
            const tagColorFromDb = tag.color;
            const tagBackgroundColor = (tagColorFromDb && isValidHexColor(tagColorFromDb)) ? tagColorFromDb : colors.surface;
            const tagTextColor = getContrastTextColor(tagBackgroundColor); // tagBackgroundColor is always a string here

            return (
              <Text key={tag.id} style={[styles.tag, { backgroundColor: tagBackgroundColor, color: tagTextColor }]}>
                {tag.name}
              </Text>
            );
          })}
        </View>
      )}
    </View>
  );
};

export default CharacterListItem;
