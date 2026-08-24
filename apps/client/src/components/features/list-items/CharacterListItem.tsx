import React from 'react';
import { Text, View } from 'react-native';
import type { CharacterWithTags } from '../../../services/storymanagement/CharacterService';
import { useTheme } from '../../../theme';
import { truncate } from '../../../utils/stringUtils';

import GenericExpandedListItemWithActions from '@/src/components/common/lists/GenericExpandedListItemWithActions/GenericExpandedListItemWithActions';
import TagList from '@/src/components/common/display/TagList/TagList';
import ListItemTitle from '@/src/components/features/list-items/ListItemTitle';
import { createSimpleEntityListItemStyles } from '@/src/components/features/list-items/styles/sharedListItemStyles';

interface CharacterListItemProps {
  character: CharacterWithTags;
  onToggleFavorite: (characterId: string, isFavorite: boolean) => void;
  onViewDetails: (characterId: string) => void;
  renderRelations?: (options: {
    expanded: boolean;
    onExpandedChange: (expanded: boolean) => void;
  }) => React.ReactNode;
}

const CharacterListItem: React.FC<CharacterListItemProps> = ({
  character,
  onToggleFavorite,
  onViewDetails,
  renderRelations,
}) => {
  const { colors } = useTheme();
  const [relationsExpanded, setRelationsExpanded] = React.useState(false);

  const descriptionSummary = truncate(character.description, 150);

  const styles = createSimpleEntityListItemStyles(colors);

  const renderHeaderContent = (char: CharacterWithTags) => (
    <ListItemTitle text={char.name} headerLeftStyle={styles.headerLeft} nameStyle={styles.name} />
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
      {char.tags && char.tags.length > 0 && <TagList tags={char.tags} />}
      {renderRelations?.({ expanded: relationsExpanded, onExpandedChange: setRelationsExpanded })}
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
