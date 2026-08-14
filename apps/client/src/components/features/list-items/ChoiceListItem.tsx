import React from 'react';
import { Text, View } from 'react-native';
import { ChoiceSelect } from '../../../db/schemas/choices'; // Corrected import path for client schemas
import { useTheme } from '../../../theme';
import { truncate } from '../../../utils/stringUtils';

import GenericExpandedListItemWithActions from '@/src/components/common/lists/GenericExpandedListItemWithActions/GenericExpandedListItemWithActions';
import { createChoiceStyles } from '@/src/components/features/list-items/styles/choiceListItemStyles'; // Will create this

interface ChoiceListItemProps {
  choice: ChoiceSelect;
  onViewDetails: (choiceId: string) => void;
}

const ChoiceListItem: React.FC<ChoiceListItemProps> = ({ choice, onViewDetails }) => {
  const { colors } = useTheme();

  const choiceText = truncate(choice.text, 150); // Use choice.text

  const styles = createChoiceStyles(colors); // Use externalized styles

  const renderHeaderContent = (cho: ChoiceSelect) => (
    <View style={styles.headerLeft}>
      <Text style={styles.name} numberOfLines={1} ellipsizeMode="tail">
        {choiceText}
      </Text>
    </View>
  );

  const renderExpandedContent = (cho: ChoiceSelect) => (
    <View>{cho.text && <Text style={styles.summaryText}>{cho.text}</Text>}</View>
  );

  return (
    <GenericExpandedListItemWithActions
      item={choice}
      onViewDetails={onViewDetails}
      renderHeaderContent={renderHeaderContent}
      renderExpandedContent={renderExpandedContent}
    />
  );
};

export default ChoiceListItem;
