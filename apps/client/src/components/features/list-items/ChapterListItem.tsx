import { Ionicons } from '@expo/vector-icons';
import { OperationLogEntityType, summarizeEntityPreview } from '@keres/shared';
import React from 'react';
import { Text, View } from 'react-native';
import type { ChapterSelect, TagSelect } from '../../../db/schema';
import { useTheme } from '../../../theme';
import { truncate } from '../../../utils/stringUtils';

import GenericExpandedListItemWithActions from '@/src/components/common/lists/GenericExpandedListItemWithActions/GenericExpandedListItemWithActions';
import ListItemTitle from '@/src/components/features/list-items/ListItemTitle';
import TagList from '@/src/components/common/display/TagList/TagList';
import { createReferenceListItemStyles } from '@/src/components/features/list-items/styles/sharedListItemStyles';
import { isUnchapteredGroup } from '@/src/utils/narrativeSceneOrder';

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

  const preview = summarizeEntityPreview(OperationLogEntityType.Chapter, chapter);
  const summaryText = truncate(preview?.primaryDetail, 150);
  const notesText = truncate(preview?.secondaryDetail, 150);

  const styles = createReferenceListItemStyles(colors);

  /**
   * An event carries no number.
   *
   * Its index is only the order the writer arranged the list in, never a position in the story, so
   * printing it would say something the data does not mean. The hourglass takes that place - the
   * one visual difference between the two kinds, which are otherwise the same container.
   */
  const renderHeaderContent = (chap: ChapterSelect) =>
    isUnchapteredGroup(chap.id) ? (
      <View style={styles.headerLeft}>
        <Text
          style={[styles.name, { fontStyle: 'italic', color: colors.textSecondary }]}
          numberOfLines={1}
          ellipsizeMode="tail"
        >
          {chap.name}
        </Text>
      </View>
    ) : chap.type === 'event' ? (
      <View style={styles.headerLeft}>
        <Ionicons
          name="hourglass-outline"
          size={16}
          color={colors.textSecondary}
          style={{ marginRight: 6 }}
          testID={`event-marker-${chap.id}`}
        />
        <Text style={styles.name} numberOfLines={1} ellipsizeMode="tail">
          {chap.name}
        </Text>
      </View>
    ) : (
      <ListItemTitle
        text={`${chap.index}. ${chap.name}`}
        headerLeftStyle={styles.headerLeft}
        nameStyle={styles.name}
      />
    );

  const renderExpandedContent = (chap: ChapterSelect) => (
    <View>
      {summaryText && <Text style={styles.summaryText}>{summaryText}</Text>}
      {notesText && <Text style={styles.notesText}>{notesText}</Text>}
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
      onToggleFavorite={isUnchapteredGroup(chapter.id) ? undefined : onToggleFavorite}
      onViewDetails={isUnchapteredGroup(chapter.id) ? undefined : onViewDetails}
      entityType={
        isUnchapteredGroup(chapter.id) ? undefined : chapter.type === 'event' ? 'Event' : 'Chapter'
      }
      renderHeaderContent={renderHeaderContent}
      renderExpandedContent={renderExpandedContent}
      initialExpanded={initialExpanded}
    />
  );
};

export default ChapterListItem;
