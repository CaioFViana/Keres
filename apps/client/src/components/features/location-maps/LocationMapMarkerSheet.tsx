import Button from '@/src/components/common/controls/Button/Button';
import ColorPickerInput from '@/src/components/common/inputs/ColorPickerInput/ColorPickerInput';
import IconPickerInput from '@/src/components/common/inputs/IconPickerInput/IconPickerInput';
import Select from '@/src/components/common/inputs/Select/Select';
import ResponsiveModal from '@/src/components/layout/ResponsiveModal/ResponsiveModal';
import { Ionicons } from '@expo/vector-icons';
import { MAP_ICON_OPTIONS } from '@keres/shared';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useTheme } from '../../../theme';

/** Keeps focus rings and input borders inside the rounded ResponsiveModal surface. */
export const LOCATION_MAP_MARKER_SHEET_INNER_PADDING = 2;
export const LOCATION_MAP_MARKER_SHEET_HORIZONTAL_INSET = 20;

interface Props {
  title: string;
  note?: string | null;
  icon: string;
  color: string;
  destinationMapId?: string | null;
  destinationName?: string | null;
  destinationUnavailable: boolean;
  destinationOptions: { label: string; value: string }[];
  canEdit: boolean;
  onChange: (changes: {
    title?: string;
    note?: string | null;
    icon?: string;
    color?: string;
  }) => void;
  onCreateDestination: () => void;
  onOpenDestination: () => void;
  onClearDestination: () => void;
  onChangeDestination: (mapId: string | null) => void;
  onRemove: () => void;
  onClose: () => void;
}

/** Editor for a free, story-owned marker. Unlike a location point it has no entity behind it. */
const LocationMapMarkerSheet: React.FC<Props> = ({
  title,
  note,
  icon,
  color,
  destinationMapId,
  destinationName,
  destinationUnavailable,
  destinationOptions,
  canEdit,
  onChange,
  onCreateDestination,
  onOpenDestination,
  onClearDestination,
  onChangeDestination,
  onRemove,
  onClose,
}) => {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = StyleSheet.create({
    sheet: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: 16,
      borderTopRightRadius: 16,
      maxHeight: '78%',
    },
    scroll: { flexShrink: 1 },
    scrollContent: {
      paddingHorizontal:
        LOCATION_MAP_MARKER_SHEET_HORIZONTAL_INSET + LOCATION_MAP_MARKER_SHEET_INNER_PADDING,
      paddingTop: LOCATION_MAP_MARKER_SHEET_INNER_PADDING,
      paddingBottom: 24,
    },
    title: { color: colors.text, fontSize: 19, fontWeight: 'bold', flex: 1 },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: LOCATION_MAP_MARKER_SHEET_HORIZONTAL_INSET,
      paddingTop: 16,
      paddingBottom: 16,
    },
    label: { color: colors.text, fontSize: 13, fontWeight: '700', marginTop: 14, marginBottom: 6 },
    input: {
      borderWidth: 1,
      borderColor: colors.border,
      color: colors.text,
      borderRadius: 8,
      padding: 10,
    },
    note: { minHeight: 96, textAlignVertical: 'top' },
    hint: { color: colors.textSecondary, marginTop: 8 },
    destination: { color: colors.primary, fontWeight: '600', marginTop: 8 },
    actionGroup: { gap: 8, marginTop: 8 },
    remove: { backgroundColor: colors.error, marginTop: 20 },
    removeInGroup: { backgroundColor: colors.error },
  });
  return (
    <ResponsiveModal visible onClose={onClose} placement="adaptive" contentStyle={styles.sheet}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('location_map_marker')}</Text>
        <TouchableOpacity onPress={onClose} accessibilityLabel={t('close')}>
          <Ionicons name="close" size={24} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>
      <ScrollView
        testID="location-map-marker-sheet-scroll"
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.label}>{t('name')}</Text>
        <TextInput
          value={title}
          editable={canEdit}
          onChangeText={(value) => onChange({ title: value })}
          style={styles.input}
        />
        <Text style={styles.label}>{t('location_map_marker_note')}</Text>
        <TextInput
          value={note ?? ''}
          editable={canEdit}
          multiline
          onChangeText={(value) => onChange({ note: value || null })}
          style={[styles.input, styles.note]}
        />
        {canEdit && (
          <>
            <Text style={styles.label}>{t('location_map_node_icon')}</Text>
            <IconPickerInput
              currentIcon={icon}
              onSelectIcon={(value) => onChange({ icon: value })}
              placeholder={t('location_map_node_icon')}
              iconOptions={MAP_ICON_OPTIONS as readonly (keyof typeof Ionicons.glyphMap)[]}
            />
            <Text style={styles.label}>{t('location_map_node_color')}</Text>
            <ColorPickerInput
              currentColor={color}
              onSelectColor={(value) => onChange({ color: value })}
              placeholder={t('location_map_node_color')}
            />
          </>
        )}
        <Text style={styles.label}>{t('location_map_destination')}</Text>
        {canEdit && (
          <Select
            options={destinationOptions}
            value={destinationMapId ?? ''}
            onValueChange={(value) => onChangeDestination(value || null)}
            placeholder={t('location_map_destination_none')}
            multiple={false}
            allowDeselect
          />
        )}
        {destinationMapId ? (
          <>
            <Text style={destinationUnavailable ? styles.hint : styles.destination}>
              {destinationUnavailable ? t('location_map_destination_unavailable') : destinationName}
            </Text>
            <View testID="location-map-marker-destination-actions" style={styles.actionGroup}>
              {!destinationUnavailable && (
                <Button onPress={onOpenDestination}>{t('location_map_open_destination')}</Button>
              )}
              {canEdit && (
                <Button onPress={onClearDestination}>{t('location_map_clear_destination')}</Button>
              )}
            </View>
          </>
        ) : canEdit ? (
          <View testID="location-map-marker-empty-destination-actions" style={styles.actionGroup}>
            <Button onPress={onCreateDestination}>{t('location_map_create_destination')}</Button>
            <Button onPress={onRemove} style={styles.removeInGroup}>
              {t('location_map_remove_marker')}
            </Button>
          </View>
        ) : (
          <Text style={styles.hint}>{t('location_map_destination_none')}</Text>
        )}
        {canEdit && destinationMapId && (
          <Button onPress={onRemove} style={styles.remove}>
            {t('location_map_remove_marker')}
          </Button>
        )}
      </ScrollView>
    </ResponsiveModal>
  );
};

export default LocationMapMarkerSheet;
