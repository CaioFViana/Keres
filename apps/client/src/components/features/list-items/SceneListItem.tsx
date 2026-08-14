import React from 'react';
import { Text, View } from 'react-native';
import { SceneSelect } from '../../../db/schema';
import { useTheme } from '../../../theme';
import { truncate } from '../../../utils/stringUtils';

import GenericExpandedListItemWithActions from '@/src/components/common/lists/GenericExpandedListItemWithActions/GenericExpandedListItemWithActions';
import { createSceneStyles } from '@/src/components/features/list-items/styles/sceneListItemStyles';

interface SceneListItemProps {
  scene: SceneSelect;
  storyType: 'linear' | 'branching' | undefined;
  onToggleFavorite: (sceneId: string, isFavorite: boolean) => void;
  onViewDetails: (sceneId: string) => void;
}

const SceneListItem: React.FC<SceneListItemProps> = ({
  scene,
  storyType,
  onToggleFavorite,
  onViewDetails,
}) => {
  const { colors } = useTheme();

  const summaryText = truncate(scene.summary, 150);

  const styles = createSceneStyles(colors); // Use externalized styles

  const renderHeaderContent = (scn: SceneSelect) => (
    <View style={styles.headerLeft}>
      <Text style={styles.name} numberOfLines={1} ellipsizeMode="tail">
        {storyType === 'linear' ? `${scn.index}. ${scn.name}` : scn.name}
      </Text>
    </View>
  );

  const renderExpandedContent = (scn: SceneSelect) => (
    <View>
      {summaryText && <Text style={styles.summaryText}>{summaryText}</Text>}
      {scn.extraNotes && <Text style={styles.notesText}>{truncate(scn.extraNotes, 150)}</Text>}
    </View>
  );

  return (
    <GenericExpandedListItemWithActions
      item={scene}
      onToggleFavorite={onToggleFavorite}
      onViewDetails={onViewDetails}
      renderHeaderContent={renderHeaderContent}
      renderExpandedContent={renderExpandedContent}
    />
  );
};

export default SceneListItem;
