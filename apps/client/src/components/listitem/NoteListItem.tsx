import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { NoteSelect } from '../../db/schemas/notes';
import { useTheme } from '../../theme';
import { truncate } from '../../utils/stringUtils';
import { useTranslation } from 'react-i18next';

import GenericExpandedListItemWithActions from '../common/GenericExpandedListItemWithActions/GenericExpandedListItemWithActions';

interface NoteListItemProps {
  note: NoteSelect;
  onViewDetails: (noteId: string) => void;
  onToggleFavorite?: (noteId: string, isFavorite: boolean) => void;
}

const NoteListItem: React.FC<NoteListItemProps> = ({ note, onViewDetails, onToggleFavorite }) => {
  const { colors } = useTheme();
  const { t } = useTranslation();

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

  const renderHeaderContent = (n: NoteSelect) => (
    <View style={styles.noteInfo}>
      <Text style={styles.noteTitle} numberOfLines={1} ellipsizeMode="tail">
        {n.title}
      </Text>
    </View>
  );

  const renderExpandedContent = (n: NoteSelect) => (
    <View>
      {bodySummary && <Text style={styles.bodyText}>{bodySummary}</Text>}
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

