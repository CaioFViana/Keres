import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import MultiSelectPill from '@/src/components/common/inputs/MultiSelectPill/MultiSelectPill';
import Button from '@/src/components/common/controls/Button/Button';
import { useTheme } from '../../../theme';

interface Props {
  imageOptions: { label: string; value: string }[];
  locationOptions: { label: string; value: string }[];
  onAddImages: (values: string[]) => void;
  onAddLocations: (values: string[]) => void;
  onAddMarker: () => void;
}

/** The pickers above the map: add image bases from the gallery and location points. */
const LocationMapTools: React.FC<Props> = ({
  imageOptions,
  locationOptions,
  onAddImages,
  onAddLocations,
  onAddMarker,
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
    pointRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
    pointControl: { flex: 1 },
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
      <View style={styles.pointRow}>
        <MultiSelectPill
          style={styles.pointControl}
          options={locationOptions}
          selectedValues={[]}
          onSelectionChange={onAddLocations}
          placeholder={t('location_map_add_locations')}
          noOptionsText={t('location_map_no_locations')}
          searchPlaceholder={t('search')}
        />
        <View style={styles.pointControl}>
          <Button onPress={onAddMarker}>{t('location_map_add_marker')}</Button>
        </View>
      </View>
    </View>
  );
};

export default LocationMapTools;
