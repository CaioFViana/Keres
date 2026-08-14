import React from 'react';
import { Text, View } from 'react-native';
import { ChapterSelect } from '../../../db/schema';
import { useTheme } from '../../../theme';
import { truncate } from '../../../utils/stringUtils';

import GenericExpandedListItemWithActions from '@/src/components/common/lists/GenericExpandedListItemWithActions/GenericExpandedListItemWithActions';
import { createChapterStyles } from '@/src/components/features/list-items/styles/chapterListItemStyles';

interface ChapterListItemProps {
  chapter: ChapterSelect;
  onToggleFavorite: (chapterId: string, isFavorite: boolean) => void;
  onViewDetails: (chapterId: string) => void;
}

const ChapterListItem: React.FC<ChapterListItemProps> = ({
  chapter,
  onToggleFavorite,
  onViewDetails,
}) => {
  const { colors } = useTheme();

  const summaryText = truncate(chapter.summary, 150);

  const styles = createChapterStyles(colors); // Use externalized styles

  const renderHeaderContent = (chap: ChapterSelect) => (
    <View style={styles.headerLeft}>
      <Text style={styles.name} numberOfLines={1} ellipsizeMode="tail">
        {`${chap.index}. ${chap.name}`}
      </Text>
    </View>
  );

  const renderExpandedContent = (chap: ChapterSelect) => (
    <View>
      {summaryText && <Text style={styles.summaryText}>{summaryText}</Text>}
      {chap.extraNotes && <Text style={styles.notesText}>{truncate(chap.extraNotes, 150)}</Text>}
    </View>
  );

  return (
    <GenericExpandedListItemWithActions
      item={chapter}
      onToggleFavorite={onToggleFavorite}
      onViewDetails={onViewDetails}
      renderHeaderContent={renderHeaderContent}
      renderExpandedContent={renderExpandedContent}
    />
  );
};

export default ChapterListItem;
