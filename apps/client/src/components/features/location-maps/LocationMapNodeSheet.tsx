import { Ionicons } from '@expo/vector-icons';
import { MAP_ICON_OPTIONS } from '@keres/shared';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Button from '@/src/components/common/controls/Button/Button';
import ColorPickerInput from '@/src/components/common/inputs/ColorPickerInput/ColorPickerInput';
import IconPickerInput from '@/src/components/common/inputs/IconPickerInput/IconPickerInput';
import MultiSelectPill from '@/src/components/common/inputs/MultiSelectPill/MultiSelectPill';
import ResponsiveModal from '@/src/components/layout/ResponsiveModal/ResponsiveModal';
import { getCommonCardStyles } from '../../../theme/commonStyles';
import { useTheme } from '../../../theme';

export interface LocationMapNodeConnection {
  relationId: string;
  otherLocationId: string;
  otherName: string;
}

interface Props {
  name: string;
  icon: string;
  color: string;
  connections: LocationMapNodeConnection[];
  /** Locations that can still be connected to this one (no `connected_to` yet). */
  connectCandidates: { id: string; name: string }[];
  canEdit: boolean;
  onChangeIcon: (icon: string) => void;
  onChangeColor: (color: string) => void;
  onAddConnection: (locationId: string) => void;
  onRemoveConnection: (relationId: string) => void;
  onRemoveNode: () => void;
  onClose: () => void;
}

/**
 * Sheet for a location point: edit its icon, manage its real `connected_to` relations (the same
 * relations the Location Relation manager owns) and remove the point from the map.
 */
const LocationMapNodeSheet: React.FC<Props> = ({
  name,
  icon,
  color,
  connections,
  connectCandidates,
  canEdit,
  onChangeIcon,
  onChangeColor,
  onAddConnection,
  onRemoveConnection,
  onRemoveNode,
  onClose,
}) => {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const cardStyles = useMemo(() => getCommonCardStyles(colors), [colors]);

  const styles = StyleSheet.create({
    sheet: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: 16,
      borderTopRightRadius: 16,
      paddingHorizontal: 20,
      paddingTop: 16,
      paddingBottom: 24,
      maxHeight: '78%',
      overflow: 'visible',
    },
    scroll: { flexGrow: 1 },
    scrollContent: { paddingHorizontal: 2, paddingVertical: 2 },
    handle: {
      alignSelf: 'center',
      width: 42,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.border,
      marginBottom: 14,
    },
    header: { flexDirection: 'row', alignItems: 'flex-start' },
    headerText: { flex: 1, marginRight: 12 },
    title: { fontSize: 19, fontWeight: 'bold', color: colors.text },
    section: {
      fontSize: 13,
      fontWeight: 'bold',
      color: colors.text,
      marginTop: 18,
      marginBottom: 8,
      textTransform: 'uppercase',
    },
    cardTitle: { marginBottom: 10 },
    item: {
      flexDirection: 'row',
      alignItems: 'center',
      borderRadius: 8,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      padding: 10,
      marginBottom: 6,
      backgroundColor: colors.surface,
    },
    itemText: { flex: 1, color: colors.text, fontSize: 13 },
    hint: { color: colors.textSecondary, fontSize: 13, marginBottom: 10 },
    removeButton: { marginTop: 16, backgroundColor: colors.error },
  });

  return (
    <ResponsiveModal visible onClose={onClose} placement="adaptive" contentStyle={styles.sheet}>
      <View style={styles.handle} />
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.title}>{name}</Text>
        </View>
        <TouchableOpacity onPress={onClose} accessibilityLabel={t('close')}>
          <Ionicons name="close" size={24} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {canEdit && (
          <>
            <Text style={styles.section}>{t('location_map_node_icon')}</Text>
            <IconPickerInput
              currentIcon={icon}
              onSelectIcon={onChangeIcon}
              placeholder={t('location_map_node_icon')}
              iconOptions={MAP_ICON_OPTIONS as readonly (keyof typeof Ionicons.glyphMap)[]}
            />
            <View style={{ height: 12 }} />
            <Text style={styles.section}>{t('location_map_node_color')}</Text>
            <ColorPickerInput
              currentColor={color}
              onSelectColor={onChangeColor}
              placeholder={t('location_map_node_color')}
            />
          </>
        )}

        <View style={cardStyles.cardContainer}>
          <Text style={[cardStyles.cardText, styles.cardTitle]}>{t('connected_locations')}</Text>
          {connections.length === 0 ? (
            <Text style={styles.hint}>{t('no_connected_locations')}</Text>
          ) : (
            connections.map((connection) => (
              <View key={connection.relationId} style={styles.item}>
                <Text style={styles.itemText}>{connection.otherName}</Text>
                {canEdit && (
                  <TouchableOpacity
                    onPress={() => onRemoveConnection(connection.relationId)}
                    accessibilityLabel={t('delete')}
                  >
                    <Ionicons name="close-circle" size={18} color={colors.error} />
                  </TouchableOpacity>
                )}
              </View>
            ))
          )}

          {canEdit && connectCandidates.length > 0 && (
            <>
              <Text style={styles.hint}>{t('location_map_connect_hint')}</Text>
              <MultiSelectPill
                options={connectCandidates.map((candidate) => ({
                  label: candidate.name,
                  value: candidate.id,
                }))}
                selectedValues={[]}
                onSelectionChange={(values) => {
                  const next = values[0];
                  if (next) onAddConnection(next);
                }}
                singleSelect
                placeholder={t('location_map_connect_pick')}
              />
            </>
          )}
        </View>

        {canEdit && (
          <Button onPress={onRemoveNode} style={styles.removeButton}>
            {t('location_map_remove_node')}
          </Button>
        )}
      </ScrollView>
    </ResponsiveModal>
  );
};

export default LocationMapNodeSheet;