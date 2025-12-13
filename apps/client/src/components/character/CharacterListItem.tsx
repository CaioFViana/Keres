import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { CharacterWithTags } from '../../services/CharacterService';
import { useTheme } from '../../theme';
import { truncate } from '../../utils/stringUtils';

// Import new generic components
import FavoriteButton from '../../components/common/Buttons/FavoriteButton';
import ViewDetailsButton from '../../components/common/Buttons/ViewDetailsButton';
import GenericListItem from '../common/GenericListItem/GenericListItem';
import TagList from '../common/TagList/TagList';

interface CharacterListItemProps {
  character: CharacterWithTags;
  onToggleFavorite: (characterId: string, isFavorite: boolean) => void;
  onViewDetails: (characterId: string) => void;
}

const CharacterListItem: React.FC<CharacterListItemProps> = ({ character, onToggleFavorite, onViewDetails }) => {
  const { colors } = useTheme();
  const [isOpen, setIsOpen] = useState(false);

  const toggleOpen = () => setIsOpen(!isOpen);

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

  const headerContent = (
    <View style={styles.headerLeft}>
      <Text style={styles.name} numberOfLines={1} ellipsizeMode="tail">
        {character.name}
      </Text>
      <FavoriteButton
        isFavorite={character.isFavorite}
        onPress={() => onToggleFavorite(character.id, !character.isFavorite)}
      />
    </View>
  );

  const rightActions = (
    <ViewDetailsButton onPress={() => onViewDetails(character.id)} />
  );

  const expandedContent = (
    <View>
      {character.title && <Text style={styles.itemTitle}>{character.title}</Text>}
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
        <TagList tags={character.tags} />
      )}
    </View>
  );

  return (
    <GenericListItem
      headerContent={headerContent}
      expandedContent={expandedContent}
      isOpen={isOpen}
      onPress={toggleOpen}
      rightActions={rightActions}
    />
  );
};

export default CharacterListItem;

