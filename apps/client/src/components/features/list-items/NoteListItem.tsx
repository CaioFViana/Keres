import React from 'react';
import { OperationLogEntityType, summarizeEntityPreview } from '@keres/shared';
import { StyleSheet, Text, View } from 'react-native';
import type { NoteWithTags } from '../../../services/storymanagement/NoteService';
import type { ThemeColors } from '../../../theme';
import { useThemedStyles } from '../../../theme/useThemedStyles';
import { typography } from '../../../theme/tokens';
import { truncate } from '../../../utils/stringUtils';

import GenericExpandedListItemWithActions from '@/src/components/common/lists/GenericExpandedListItemWithActions/GenericExpandedListItemWithActions';
import TagList from '@/src/components/common/display/TagList/TagList';

interface NoteListItemProps {
  note: NoteWithTags;
  onViewDetails: (noteId: string) => void;
  onToggleFavorite?: (noteId: string, isFavorite: boolean) => void;
}

const NoteListItem: React.FC<NoteListItemProps> = ({ note, onViewDetails, onToggleFavorite }) => {
  const preview = summarizeEntityPreview(OperationLogEntityType.Note, note);
  const bodySummary = truncate(preview?.primaryDetail, 300);

  const styles = useThemedStyles(createStyles);

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
      {n.tags &&
        n.tags.length > 0 && ( // Conditionally render TagList
          <TagList tags={n.tags} />
        )}
    </View>
  );

  return (
    <GenericExpandedListItemWithActions
      item={note}
      onToggleFavorite={onToggleFavorite}
      onViewDetails={onViewDetails}
      entityType="Note"
      renderHeaderContent={renderHeaderContent}
      renderExpandedContent={renderExpandedContent}
    />
  );
};

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    noteInfo: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
    },
    noteTitle: {
      ...typography.title,
      color: colors.text,
      flexShrink: 1,
    },
    bodyText: {
      fontSize: 14,
      color: colors.textSecondary,
      marginTop: 5,
    },
  });

export default NoteListItem;
