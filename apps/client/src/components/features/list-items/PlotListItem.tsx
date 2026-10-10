import GenericExpandedListItemWithActions from '@/src/components/common/lists/GenericExpandedListItemWithActions/GenericExpandedListItemWithActions';
import ListItemTitle from '@/src/components/features/list-items/ListItemTitle';
import { createSimpleEntityListItemStyles } from '@/src/components/features/list-items/styles/sharedListItemStyles';
import { OperationLogEntityType, summarizeEntityPreview } from '@keres/shared';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import type { PlotSelect } from '../../../db/schema';
import type { ThemeColors } from '../../../theme';
import { useThemedStyles } from '../../../theme/useThemedStyles';
import { truncate } from '../../../utils/stringUtils';

interface PlotListItemProps {
  plot: PlotSelect;
  /** Scenes linked to this Plot; a Plot with none is valid and shows "0 scenes". */
  sceneCount: number;
  onViewDetails: (plotId: string) => void;
}

const PlotListItem: React.FC<PlotListItemProps> = ({ plot, sceneCount, onViewDetails }) => {
  const { t } = useTranslation();
  const preview = summarizeEntityPreview(OperationLogEntityType.Plot, plot);

  const styles = useThemedStyles(createStyles);

  return (
    <GenericExpandedListItemWithActions
      item={plot}
      onViewDetails={onViewDetails}
      entityType="Plot"
      renderHeaderContent={(item) => (
        <View style={{ flex: 1 }}>
          <ListItemTitle
            text={item.name}
            headerLeftStyle={styles.headerLeft}
            nameStyle={styles.name}
          />
          <Text style={styles.count}>
            {t(sceneCount === 1 ? 'plot_scene_count_one' : 'plot_scene_count_other', {
              count: sceneCount,
            })}
          </Text>
        </View>
      )}
      renderExpandedContent={(item) => (
        <Text style={styles.descriptionText}>
          {preview?.primaryDetail ? truncate(preview.primaryDetail, 300) : t('no_plot_details')}
        </Text>
      )}
    />
  );
};

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    ...createSimpleEntityListItemStyles(colors),
    count: {
      color: colors.textSecondary,
      fontSize: 13,
      fontWeight: '600',
    },
  });

export default PlotListItem;
