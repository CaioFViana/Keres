import React from 'react';
import { OperationLogEntityType, summarizeEntityPreview } from '@keres/shared';
import { Text, View } from 'react-native';
import type { LocationWithTags } from '../../../services/storymanagement/LocationService'; // Will be created soon
import { useTheme } from '../../../theme';
import { truncate } from '../../../utils/stringUtils';
import GenericExpandedListItemWithActions from '@/src/components/common/lists/GenericExpandedListItemWithActions/GenericExpandedListItemWithActions';
import TagList from '@/src/components/common/display/TagList/TagList';
import { createLocationStyles } from '@/src/components/features/list-items/styles/locationListItemStyles';

interface LocationListItemProps {
  location: LocationWithTags;
  onToggleFavorite: (locationId: string, isFavorite: boolean) => void;
  onViewDetails: (locationId: string) => void;
}

const LocationListItem: React.FC<LocationListItemProps> = ({
  location,
  onToggleFavorite,
  onViewDetails,
}) => {
  const { colors } = useTheme();

  const preview = summarizeEntityPreview(OperationLogEntityType.Location, location);
  const descriptionSummary = truncate(preview?.primaryDetail, 150);

  const styles = createLocationStyles(colors);

  const renderHeaderContent = (loc: LocationWithTags) => (
    <View style={styles.headerLeft}>
      <Text style={styles.name} numberOfLines={1} ellipsizeMode="tail">
        {loc.name}
      </Text>
    </View>
  );

  const renderExpandedContent = (loc: LocationWithTags) => (
    <View>
      {descriptionSummary && <Text style={styles.descriptionText}>{descriptionSummary}</Text>}
      {(loc.climate || loc.culture || loc.politics) && (
        <Text style={styles.summaryText}>
          {loc.climate ? `Climate: ${loc.climate}` : ''}
          {loc.climate && (loc.culture || loc.politics) ? ' - ' : ''}
          {loc.culture ? `Culture: ${loc.culture}` : ''}
          {loc.culture && loc.politics ? ' - ' : ''}
          {loc.politics ? `Politics: ${loc.politics}` : ''}
        </Text>
      )}
      {loc.tags && loc.tags.length > 0 && <TagList tags={loc.tags} />}
    </View>
  );

  return (
    <GenericExpandedListItemWithActions
      item={location}
      onToggleFavorite={onToggleFavorite}
      onViewDetails={onViewDetails}
      entityType="Location"
      renderHeaderContent={renderHeaderContent}
      renderExpandedContent={renderExpandedContent}
    />
  );
};

export default LocationListItem;
