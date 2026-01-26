import React from 'react';
import { Text, View } from 'react-native';
import { ItemJourneySelect } from '../../db/schemas/itemJourneys';
import { useTheme } from '../../theme';
import { truncate } from '../../utils/stringUtils';

import GenericExpandedListItemWithActions from '../common/GenericExpandedListItemWithActions/GenericExpandedListItemWithActions';
import { createItemJourneyStyles } from './styles/itemJourneyListItemStyles';
import { useItemStore } from '../../state/itemStore';
import { useSceneStore } from '../../state/sceneStore';
import { useCharacterStore } from '../../state/characterStore';
import { useTranslation } from 'react-i18next';

interface ItemJourneyListItemProps {
  itemJourney: ItemJourneySelect;
  onViewDetails: (itemJourneyId: string) => void;
}

const ItemJourneyListItem: React.FC<ItemJourneyListItemProps> = ({ itemJourney, onViewDetails }) => {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const styles = createItemJourneyStyles(colors);

  const { items } = useItemStore();
  const { scenes } = useSceneStore();
  const { characters } = useCharacterStore();

  const relatedItem = items.find(item => item.id === itemJourney.itemId);
  const relatedScene = scenes.find(scene => scene.id === itemJourney.sceneId);
  const newCharacterOwner = characters.find(char => char.id === itemJourney.newCharacterOwnerId);

  const renderHeaderContent = (currentItemJourney: ItemJourneySelect) => (
    <View style={styles.headerLeft}>
      <Text style={styles.name} numberOfLines={1} ellipsizeMode="tail">
        {relatedItem?.name || t('unknown_item')} - {currentItemJourney.newState}
      </Text>
    </View>
  );

  const renderExpandedContent = (currentItemJourney: ItemJourneySelect) => (
    <View>
      {relatedScene && <Text style={styles.detailText}>{t('scene')}: {relatedScene.name}</Text>}
      {newCharacterOwner && <Text style={styles.detailText}>{t('new_character_owner')}: {newCharacterOwner.name}</Text>}
      {currentItemJourney.extraNotes && <Text style={styles.notesText}>{truncate(currentItemJourney.extraNotes, 200)}</Text>}
    </View>
  );

  return (
    <GenericExpandedListItemWithActions
      item={itemJourney}
      onViewDetails={onViewDetails}
      renderHeaderContent={renderHeaderContent}
      renderExpandedContent={renderExpandedContent}
    />
  );
};

export default ItemJourneyListItem;