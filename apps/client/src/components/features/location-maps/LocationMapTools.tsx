import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import MultiSelectPill from '@/src/components/common/inputs/MultiSelectPill/MultiSelectPill';
import { useTheme } from '../../../theme';

interface Props {
  imageOptions: { label: string; value: string }[];
  locationOptions: { label: string; value: string }[];
  onAddImages: (values: string[]) => void;
  onAddLocations: (values: string[]) => void;
}

/** The pickers above the map: add image bases from the gallery and location points. */
const LocationMapTools: React.FC<Props> = ({
  imageOptions,
  locationOptions,
  onAddImages,
  onAddLocations,
}) => {
  const { colors } = useTheme();
  const { t } = useTranslation();

  const styles = StyleSheet.create({
    tools: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
      backgroundColor: colors.surface,
    },
  });

  return (
    <View style={styles.tools}>
      <MultiSelectPill
        options={imageOptions}
        selectedValues={[]}
        onSelectionChange={onAddImages}
        placeholder={t('location_map_add_images')}
        noOptionsText={t('location_map_no_images')}
        searchPlaceholder={t('search')}
      />
      <MultiSelectPill
        options={locationOptions}
        selectedValues={[]}
        onSelectionChange={onAddLocations}
        placeholder={t('location_map_add_locations')}
        noOptionsText={t('location_map_no_locations')}
        searchPlaceholder={t('search')}
      />
    </View>
  );
};

export default LocationMapTools;
