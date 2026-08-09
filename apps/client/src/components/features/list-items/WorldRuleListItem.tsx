import React from 'react';
import { Text, View } from 'react-native';
import { useTheme } from '../../../theme';
import { truncate } from '../../../utils/stringUtils';

import { WorldRuleWithTags } from '../../../db/schemas/worldRules';
import GenericExpandedListItemWithActions from '@/src/components/common/lists/GenericExpandedListItemWithActions/GenericExpandedListItemWithActions';
import TagList from '@/src/components/common/display/TagList/TagList';
import { createWorldRuleStyles } from '@/src/components/features/list-items/styles/worldRuleListItemStyles';

interface WorldRuleListItemProps {
  worldRule: WorldRuleWithTags;
  onToggleFavorite: (worldRuleId: string, isFavorite: boolean) => void;
  onViewDetails: (worldRuleId: string) => void;
}

const WorldRuleListItem: React.FC<WorldRuleListItemProps> = ({ worldRule, onToggleFavorite, onViewDetails }) => {
  const { colors } = useTheme();

  const descriptionSummary = truncate(worldRule.description, 150);

  const styles = createWorldRuleStyles(colors);

  const renderHeaderContent = (rule: WorldRuleWithTags) => (
    <View style={styles.headerLeft}>
      <Text style={styles.name} numberOfLines={1} ellipsizeMode="tail">
        {rule.title}
      </Text>
    </View>
  );

  const renderExpandedContent = (rule: WorldRuleWithTags) => (
    <View>
      {descriptionSummary && <Text style={styles.descriptionText}>{descriptionSummary}</Text>}
      {rule.tags && rule.tags.length > 0 && (
        <TagList tags={rule.tags} />
      )}
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