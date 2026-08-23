import React from 'react';
import { Text, View } from 'react-native';
import { SceneSelect } from '../../../db/schema';
import { useTheme } from '../../../theme';
import { truncate } from '../../../utils/stringUtils';

import GenericExpandedListItemWithActions from '@/src/components/common/lists/GenericExpandedListItemWithActions/GenericExpandedListItemWithActions';
import ListItemTitle from '@/src/components/features/list-items/ListItemTitle';
import { createReferenceListItemStyles } from '@/src/components/features/list-items/styles/sharedListItemStyles';

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

  const styles = createReferenceListItemStyles(colors);

  const renderHeaderContent = (scn: SceneSelect) => (
    <ListItemTitle
      // Cenas são armazenadas com índice zero-based para reordenação; autores veem a contagem
      // humana, começando em 1, como já acontece na lista de capítulos.
      text={storyType === 'linear' ? `${scn.index + 1}. ${scn.name}` : scn.name}
      headerLeftStyle={styles.headerLeft}
      nameStyle={styles.name}
    />
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
