import React from 'react';
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

  const summaryText = truncate(scene.summary, 150);

  const styles = createReferenceListItemStyles(colors);

  const renderHeaderContent = (scn: SceneSelect) => (
    <ListItemTitle
      // O índice da cena já é a contagem humana: 1..N dentro do capítulo, a mesma convenção
      // dos capítulos (ver `StoryIndexService`).
      text={storyType === 'linear' ? `${scn.index}. ${scn.name}` : scn.name}
      headerLeftStyle={styles.headerLeft}
      nameStyle={styles.name}
    />
  );

  const renderExpandedContent = (scn: SceneSelect) => (
    <View>
      {summaryText && <Text style={styles.summaryText}>{summaryText}</Text>}
      {scn.extraNotes && <Text style={styles.notesText}>{truncate(scn.extraNotes, 150)}</Text>}
      {tags.length > 0 && <TagList tags={tags} />}
    </View>
  );

  return (
    <GenericExpandedListItemWithActions
      item={scene}
      onToggleFavorite={onToggleFavorite}
      onViewDetails={onViewDetails}
      renderHeaderContent={renderHeaderContent}
      renderExpandedContent={renderExpandedContent}
      density={density}
      isExpanded={isExpanded}
      onExpandedChange={onExpandedChange}
    />
  );
};

export default SceneListItem;
