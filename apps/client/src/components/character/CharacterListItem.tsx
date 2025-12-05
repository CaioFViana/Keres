import React, { useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Pressable } from 'react-native';
import { CharacterWithTags } from '../../services/CharacterService';
import { useTheme } from '../../theme';
import { isValidHexColor, getContrastTextColor } from '../../utils/colorUtils';
import { truncate } from '../../utils/stringUtils';
import { MaterialCommunityIcons } from '@expo/vector-icons';

interface CharacterListItemProps {
  character: CharacterWithTags;
  onToggleFavorite: (characterId: string, isFavorite: boolean) => void;
  onViewDetails: (characterId: string) => void; // New prop for viewing details
}

const CharacterListItem: React.FC<CharacterListItemProps> = ({ character, onToggleFavorite, onViewDetails }) => {
  const { colors } = useTheme();
  const [isOpen, setIsOpen] = useState(false);

  const toggleOpen = () => setIsOpen(!isOpen);

  const descriptionSummary = truncate(character.description, 150);

  const styles = StyleSheet.create({
    container: {
      backgroundColor: colors.card,
      marginVertical: 4,
      borderRadius: 8,
      overflow: 'hidden', // Ensures content doesn't overflow rounded corners
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 10,
      borderBottomWidth: isOpen ? 1 : 0,
      borderBottomColor: colors.border,
    },
    headerLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      flexShrink: 1, // Allow text to shrink
    },
    name: {
      color: colors.text,
      fontSize: 18,
      fontWeight: 'bold',
      marginRight: 10,
    },
    headerRight: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    viewButton: {
      padding: 5,
      marginRight: 5,
    },
    favoriteButton: {
      padding: 5,
    },
    dropdownArrow: {
      marginLeft: 10,
    },
    content: {
      padding: 10,
    },
    summaryText: {
      color: colors.textSecondary,
      fontSize: 14,
      marginBottom: 5,
    },
    descriptionText: {
      color: colors.text,
      fontSize: 14,
      marginTop: 5,
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
      <Pressable onPress={toggleOpen} style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.name} numberOfLines={1} ellipsizeMode="tail">
            {character.name}
          </Text>
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

        <View style={styles.headerRight}>
          <TouchableOpacity onPress={() => onViewDetails(character.id)} style={styles.viewButton}>
            <MaterialCommunityIcons name="eye" size={24} color={colors.primary} />
          </TouchableOpacity>
          <MaterialCommunityIcons
            name={isOpen ? 'chevron-up' : 'chevron-down'}
            size={24}
            color={colors.textSecondary}
            style={styles.dropdownArrow}
          />
        </View>
      </Pressable>

      {isOpen && (
        <View style={styles.content}>
          {(character.gender || character.race) && (
            <Text style={styles.summaryText}>
              {character.gender ? `${character.gender}` : ''}
              {character.gender && (character.race || character.subrace) ? ' - ' : ''}
              {character.race ? `${character.race}` : ''}
              {character.subrace ? ` (${character.subrace})` : ''}
            </Text>
          )}
          {descriptionSummary && <Text style={styles.descriptionText}>{descriptionSummary}</Text>}
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
      )}
    </View>
  );
};

export default CharacterListItem;
