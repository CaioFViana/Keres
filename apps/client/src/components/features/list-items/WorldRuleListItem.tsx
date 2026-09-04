import React from 'react';
import { getWorldPieceSectionAppearance } from '@keres/shared';
import { OperationLogEntityType, summarizeEntityPreview } from '@keres/shared';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';
import { useTheme } from '../../../theme';
import { truncate } from '../../../utils/stringUtils';

import type { WorldRuleWithTags } from '../../../db/schemas/worldRules';
import GenericExpandedListItemWithActions from '@/src/components/common/lists/GenericExpandedListItemWithActions/GenericExpandedListItemWithActions';
import TagList from '@/src/components/common/display/TagList/TagList';
import ListItemTitle from '@/src/components/features/list-items/ListItemTitle';
import { createSimpleEntityListItemStyles } from '@/src/components/features/list-items/styles/sharedListItemStyles';

interface WorldRuleListItemProps {
  worldRule: WorldRuleWithTags;
  onToggleFavorite: (worldRuleId: string, isFavorite: boolean) => void;
  onViewDetails: (worldRuleId: string) => void;
}

const WorldRuleListItem: React.FC<WorldRuleListItemProps> = ({
  worldRule,
  onToggleFavorite,
  onViewDetails,
}) => {
  const { colors } = useTheme();
  const { t } = useTranslation();

  const preview = summarizeEntityPreview(OperationLogEntityType.WorldRule, worldRule);
  const descriptionSummary = truncate(preview?.primaryDetail, 150);

  const styles = createSimpleEntityListItemStyles(colors);

  const renderHeaderContent = (rule: WorldRuleWithTags) => (
    <ListItemTitle text={rule.title} headerLeftStyle={styles.headerLeft} nameStyle={styles.name} />
  );

  const renderExpandedContent = (rule: WorldRuleWithTags) => (
    <View>
      <Text style={[styles.descriptionText, { fontWeight: '600' }]}>
        {t(`world_piece_section_${rule.section}`)}
        {rule.type ? ` · ${rule.type}` : ''}
      </Text>
      {descriptionSummary && <Text style={styles.descriptionText}>{descriptionSummary}</Text>}
      {rule.tags && rule.tags.length > 0 && <TagList tags={rule.tags} />}
    </View>
  );

  return (
    <GenericExpandedListItemWithActions
      item={worldRule}
      onToggleFavorite={onToggleFavorite}
      onViewDetails={onViewDetails}
      entityAppearance={getWorldPieceSectionAppearance(worldRule.section)}
      renderHeaderContent={renderHeaderContent}
      renderExpandedContent={renderExpandedContent}
    />
  );
};

export default WorldRuleListItem;
