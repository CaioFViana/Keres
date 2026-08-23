import React from 'react';
import { Text, View } from 'react-native';
import { ChapterSelect, TagSelect } from '../../../db/schema';
import { useTheme } from '../../../theme';
import { truncate } from '../../../utils/stringUtils';

import GenericExpandedListItemWithActions from '@/src/components/common/lists/GenericExpandedListItemWithActions/GenericExpandedListItemWithActions';
import ListItemTitle from '@/src/components/features/list-items/ListItemTitle';
import TagList from '@/src/components/common/display/TagList/TagList';
import { createReferenceListItemStyles } from '@/src/components/features/list-items/styles/sharedListItemStyles';

interface ChapterListItemProps {
  chapter: ChapterSelect;
  onToggleFavorite: (chapterId: string, isFavorite: boolean) => void;
  onViewDetails: (chapterId: string) => void;
  renderScenes?: (options: {
    expandedSceneIds: ReadonlySet<string>;
    onSceneExpandedChange: (sceneId: string, isExpanded: boolean) => void;
  }) => React.ReactNode;
  initialExpanded?: boolean;
  tags?: TagSelect[];
}

const ChapterListItem: React.FC<ChapterListItemProps> = ({
  chapter,
  onToggleFavorite,
  onViewDetails,
  renderScenes,
  initialExpanded,
  tags = [],
}) => {
  const { colors } = useTheme();
  const [expandedSceneIds, setExpandedSceneIds] = React.useState<ReadonlySet<string>>(new Set());

  const summaryText = truncate(chapter.summary, 150);

  const styles = createReferenceListItemStyles(colors);

  const renderHeaderContent = (chap: ChapterSelect) => (
    <ListItemTitle
      text={`${chap.index}. ${chap.name}`}
      headerLeftStyle={styles.headerLeft}
      nameStyle={styles.name}
    />
  );

  const renderExpandedContent = (chap: ChapterSelect) => (
    <View>
      {summaryText && <Text style={styles.summaryText}>{summaryText}</Text>}
      {chap.extraNotes && <Text style={styles.notesText}>{truncate(chap.extraNotes, 150)}</Text>}
      {tags.length > 0 && <TagList tags={tags} />}
      {renderScenes?.({
        expandedSceneIds,
        onSceneExpandedChange: (sceneId, isExpanded) => {
          setExpandedSceneIds((previous) => {
            const next = new Set(previous);
            if (isExpanded) next.add(sceneId);
            else next.delete(sceneId);
            return next;
          });
        },
      })}
    </View>
  );

  return (
    <GenericExpandedListItemWithActions
      item={chapter}
      onToggleFavorite={onToggleFavorite}
      onViewDetails={onViewDetails}
      renderHeaderContent={renderHeaderContent}
      renderExpandedContent={renderExpandedContent}
      initialExpanded={initialExpanded}
    />
  );
};

export default ChapterListItem;
