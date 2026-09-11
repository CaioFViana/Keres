import React from 'react';
import { OperationLogEntityType, summarizeEntityPreview } from '@keres/shared';
import { Text, View } from 'react-native';
import type { SceneSelect, TagSelect } from '../../../db/schema';
import { useTheme } from '../../../theme';
import { truncate } from '../../../utils/stringUtils';

import GenericExpandedListItemWithActions from '@/src/components/common/lists/GenericExpandedListItemWithActions/GenericExpandedListItemWithActions';
import ListItemTitle from '@/src/components/features/list-items/ListItemTitle';
import TagList from '@/src/components/common/display/TagList/TagList';
import { createReferenceListItemStyles } from '@/src/components/features/list-items/styles/sharedListItemStyles';

interface SceneListItemProps {
  scene: SceneSelect;
  storyType: 'linear' | 'branching' | undefined;
  onToggleFavorite: (sceneId: string, isFavorite: boolean) => void;
  onViewDetails: (sceneId: string) => void;
  density?: 'default' | 'nested';
  isExpanded?: boolean;
  onExpandedChange?: (isExpanded: boolean) => void;
  tags?: TagSelect[];
}

const SceneListItem: React.FC<SceneListItemProps> = ({
  scene,
  storyType,
  onToggleFavorite,
  onViewDetails,
  density,
  isExpanded,
  onExpandedChange,
  tags = [],
}) => {
  const { colors } = useTheme();

  const preview = summarizeEntityPreview(OperationLogEntityType.Scene, scene);
  const summaryText = truncate(preview?.primaryDetail, 150);
  const notesText = truncate(preview?.secondaryDetail, 150);

  const styles = createReferenceListItemStyles(colors);

  const renderHeaderContent = (scn: SceneSelect) => (
    <ListItemTitle
      // The scene's index is already the human count: 1..N within the chapter, the same convention
      // as the chapters (see `StoryIndexService`).
      text={storyType === 'linear' && scn.chapterId ? `${scn.index}. ${scn.name}` : scn.name}
      headerLeftStyle={styles.headerLeft}
      nameStyle={styles.name}
    />
  );

  const renderExpandedContent = (scn: SceneSelect) => (
    <View>
      {summaryText && <Text style={styles.summaryText}>{summaryText}</Text>}
      {notesText && <Text style={styles.notesText}>{notesText}</Text>}
      {tags.length > 0 && <TagList tags={tags} />}
    </View>
  );

  return (
    <GenericExpandedListItemWithActions
      item={scene}
      onToggleFavorite={onToggleFavorite}
      onViewDetails={onViewDetails}
      entityType="Scene"
      renderHeaderContent={renderHeaderContent}
      renderExpandedContent={renderExpandedContent}
      density={density}
      isExpanded={isExpanded}
      onExpandedChange={onExpandedChange}
    />
  );
};

export default SceneListItem;
