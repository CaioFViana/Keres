import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { WorldRuleSelect } from '../../db';
import { useTheme } from '../../theme';
import { truncate } from '../../utils/stringUtils';

import GenericExpandedListItemWithActions from '../common/GenericExpandedListItemWithActions/GenericExpandedListItemWithActions';

interface WorldRuleListItemProps {
  worldRule: WorldRuleSelect;
  onViewDetails: (worldRuleId: string) => void;
  onToggleFavorite?: (worldRuleId: string, isFavorite: boolean) => void;
}

const WorldRuleListItem: React.FC<WorldRuleListItemProps> = ({ worldRule, onViewDetails, onToggleFavorite }) => {
  const { colors } = useTheme();
  const { t } = useTranslation();

  const descriptionSummary = truncate(worldRule.description || '', 300);

  const styles = StyleSheet.create({
    worldRuleInfo: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
    },
    worldRuleTitle: {
      fontSize: 18,
      fontWeight: 'bold',
      color: colors.text,
      flexShrink: 1,
    },
    descriptionText: {
      fontSize: 14,
      color: colors.textSecondary,
      marginTop: 5,
    },
    extraNotesText: {
      fontSize: 14,
      color: colors.textSecondary,
      marginTop: 5,
    },
  });

  const renderHeaderContent = (wr: WorldRuleSelect) => (
    <View style={styles.worldRuleInfo}>
      <Text style={styles.worldRuleTitle} numberOfLines={1} ellipsizeMode="tail">
        {wr.title}
      </Text>
    </View>
  );

  const renderExpandedContent = (wr: WorldRuleSelect) => (
    <View>
      {descriptionSummary && <Text style={styles.descriptionText}>{descriptionSummary}</Text>}
    </View>
  );

  return (
    <GenericExpandedListItemWithActions
      item={worldRule}
      onToggleFavorite={onToggleFavorite}
      onViewDetails={onViewDetails}
      renderHeaderContent={renderHeaderContent}
      renderExpandedContent={renderExpandedContent}
    />
  );
};

export default WorldRuleListItem;
