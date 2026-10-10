import React from 'react';
import { OperationLogEntityType, summarizeEntityPreview } from '@keres/shared';
import { StyleSheet, Text, View } from 'react-native';
import type { TagSelect } from '../../../db/schemas/tags';
import type { ThemeColors } from '../../../theme';
import { useThemedStyles } from '../../../theme/useThemedStyles';
import { typography } from '../../../theme/tokens';
import { truncate } from '../../../utils/stringUtils';

import GenericExpandedListItemWithActions from '@/src/components/common/lists/GenericExpandedListItemWithActions/GenericExpandedListItemWithActions';

interface TagListItemProps {
  tag: TagSelect;
  onViewDetails: (tagId: string) => void;
  onToggleFavorite?: (tagId: string, isFavorite: boolean) => void;
}

const TagListItem: React.FC<TagListItemProps> = ({ tag, onViewDetails, onToggleFavorite }) => {
  const preview = summarizeEntityPreview(OperationLogEntityType.Tag, tag);
  const extraNotesSummary = truncate(preview?.primaryDetail, 150);

  const styles = useThemedStyles(createStyles);

  const renderHeaderContent = (t: TagSelect) => (
    <View style={styles.tagInfo}>
      {t.color && <View style={[styles.tagColorIndicator, { backgroundColor: t.color }]} />}
      <Text style={styles.tagName} numberOfLines={1} ellipsizeMode="tail">
        {t.name}
      </Text>
    </View>
  );

  const renderExpandedContent = (t: TagSelect) => (
    <View>
      {extraNotesSummary && <Text style={styles.descriptionText}>{extraNotesSummary}</Text>}
    </View>
  );

  return (
    <GenericExpandedListItemWithActions
      item={tag}
      onToggleFavorite={onToggleFavorite}
      onViewDetails={onViewDetails}
      entityType="Tag"
      renderHeaderContent={renderHeaderContent}
      renderExpandedContent={renderExpandedContent}
    />
  );
};

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    tagInfo: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
    },
    tagColorIndicator: {
      width: 20,
      height: 20,
      borderRadius: 10,
      marginRight: 10,
      borderWidth: 1,
      borderColor: colors.border,
    },
    tagName: {
      ...typography.title,
      color: colors.text,
      flexShrink: 1,
    },
    descriptionText: {
      fontSize: 14,
      color: colors.textSecondary,
      marginTop: 5,
    },
  });

export default TagListItem;
