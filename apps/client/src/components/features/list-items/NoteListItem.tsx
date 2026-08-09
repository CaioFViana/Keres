import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { NoteWithTags } from '../../../services/storymanagement/NoteService';
import { useTheme } from '../../../theme';
import { truncate } from '../../../utils/stringUtils';

import GenericExpandedListItemWithActions from '@/src/components/common/lists/GenericExpandedListItemWithActions/GenericExpandedListItemWithActions';
import TagList from '@/src/components/common/display/TagList/TagList';

interface NoteListItemProps {
  note: NoteWithTags;
  onViewDetails: (noteId: string) => void;
  onToggleFavorite?: (noteId: string, isFavorite: boolean) => void;
}

const NoteListItem: React.FC<NoteListItemProps> = ({ note, onViewDetails, onToggleFavorite }) => {
  const { colors } = useTheme();

  const bodySummary = truncate(note.body || '', 300);

  const styles = StyleSheet.create({
    noteInfo: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
    },
    noteTitle: {
      fontSize: 18,
      fontWeight: 'bold',
      color: colors.text,
      flexShrink: 1,
    },
    bodyText: {
      fontSize: 14,
      color: colors.textSecondary,
      marginTop: 5,
    },
  });

  const renderHeaderContent = (n: NoteWithTags) => (
    <View style={styles.noteInfo}>
      <Text style={styles.noteTitle} numberOfLines={1} ellipsizeMode="tail">
        {n.title}
      </Text>
    </View>
  );

  const renderExpandedContent = (n: NoteWithTags) => (
    <View>
      {bodySummary && <Text style={styles.bodyText}>{bodySummary}</Text>}
      {n.tags && n.tags.length > 0 && ( // Conditionally render TagList
        <TagList tags={n.tags} />
      )}
    </View>
  );

  return (
    <GenericExpandedListItemWithActions
      item={note}
      onToggleFavorite={onToggleFavorite}
      onViewDetails={onViewDetails}
      renderHeaderContent={renderHeaderContent}
      renderExpandedContent={renderExpandedContent}
    />
  );
};

export default NoteListItem;

