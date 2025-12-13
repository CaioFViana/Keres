import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { CharacterWithTags } from '../../services/CharacterService';
import { useTheme } from '../../theme';
import { truncate } from '../../utils/stringUtils';

// Import the new consolidated component
import GenericExpandedListItemWithActions from '../common/GenericExpandedListItemWithActions/GenericExpandedListItemWithActions';
import TagList from '../common/TagList/TagList';

interface CharacterListItemProps {
  character: CharacterWithTags;
  onToggleFavorite: (characterId: string, isFavorite: boolean) => void;
  onViewDetails: (characterId: string) => void;
}

const CharacterListItem: React.FC<CharacterListItemProps> = ({ character, onToggleFavorite, onViewDetails }) => {
  const { colors } = useTheme();

  const descriptionSummary = truncate(character.description, 150);

  const styles = StyleSheet.create({
    headerLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      flexShrink: 1,
    },
    name: {
      color: colors.text,
      fontSize: 18,
      fontWeight: 'bold',
      marginRight: 10,
    },
    itemTitle: {
      color: colors.text,
      fontSize: 16,
      fontWeight: '600',
      marginBottom: 5,
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
  });

  const renderHeaderContent = (char: CharacterWithTags) => (
    <View style={styles.headerLeft}>
      <Text style={styles.name} numberOfLines={1} ellipsizeMode="tail">
        {char.name}
      </Text>
    </View>
  );

  const renderExpandedContent = (char: CharacterWithTags) => (
    <View>
      {char.title && <Text style={styles.itemTitle}>{char.title}</Text>}
      {(char.gender || char.race) && (
        <Text style={styles.summaryText}>
          {char.gender ? `${char.gender}` : ''}
          {char.gender && (char.race || char.subrace) ? ' - ' : ''}
          {char.race ? `${char.race}` : ''}
          {char.subrace ? ` (${char.subrace})` : ''}
        </Text>
      )}
      {descriptionSummary && <Text style={styles.descriptionText}>{descriptionSummary}</Text>}
      {char.tags && char.tags.length > 0 && (
        <TagList tags={char.tags} />
      )}
    </View>
  );

  return (
    <GenericExpandedListItemWithActions
      item={character}
      onToggleFavorite={onToggleFavorite}
      onViewDetails={onViewDetails}
      renderHeaderContent={renderHeaderContent}
      renderExpandedContent={renderExpandedContent}
    />
  );
};

export default CharacterListItem;

