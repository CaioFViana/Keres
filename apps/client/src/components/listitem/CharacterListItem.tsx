import React from 'react';
import { Text, View } from 'react-native';
import { CharacterWithTags } from '../../services/CharacterService';
import { useTheme } from '../../theme';
import { truncate } from '../../utils/stringUtils';

import GenericExpandedListItemWithActions from '../common/GenericExpandedListItemWithActions/GenericExpandedListItemWithActions';
import TagList from '../common/TagList/TagList';
import { createCharacterStyles } from './styles/characterListItemStyles';

interface CharacterListItemProps {
  character: CharacterWithTags;
  onToggleFavorite: (characterId: string, isFavorite: boolean) => void;
  onViewDetails: (characterId: string) => void;
}

const CharacterListItem: React.FC<CharacterListItemProps> = ({ character, onToggleFavorite, onViewDetails }) => {
  const { colors } = useTheme();

  const descriptionSummary = truncate(character.description, 150);

  const styles = createCharacterStyles(colors); // Use externalized styles

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

