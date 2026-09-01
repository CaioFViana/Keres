import Button from '@/src/components/common/controls/Button/Button';
import ColorPickerInput from '@/src/components/common/inputs/ColorPickerInput/ColorPickerInput';
import IconPickerInput from '@/src/components/common/inputs/IconPickerInput/IconPickerInput';
import MultiSelectPill from '@/src/components/common/inputs/MultiSelectPill/MultiSelectPill';
import ResponsiveModal from '@/src/components/layout/ResponsiveModal/ResponsiveModal';
import { Ionicons } from '@expo/vector-icons';
import { MAP_ICON_OPTIONS } from '@keres/shared';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTheme } from '../../../theme';
import { getCommonCardStyles } from '../../../theme/commonStyles';
import type { BoardEntitySummary } from '../../../utils/boardEntitySummary';
import type {
  LocationMapChildRelation,
  LocationMapParentRelation,
} from '../../../utils/locationMapRelations';

export interface LocationMapNodeConnection {
  relationId: string;
  otherLocationId: string;
  otherName: string;
}

interface Props {
  name: string;
  /** The location's description, loaded without leaving the map. */
  summary?: BoardEntitySummary | null;
  icon: string;
  color: string;
  /** The `contains` relation that makes this location a child (its parent), if any. */
  parent: LocationMapParentRelation | null;
  /** The `contains` relations that make this location a parent (its children). */
  childLocations: LocationMapChildRelation[];
  connections: LocationMapNodeConnection[];
  /** Locations that can still become this one's parent (no cycle, not already the parent). */
  parentCandidates: { id: string; name: string }[];
  /** Locations that can still become this one's child (no cycle, not already a child). */
  childCandidates: { id: string; name: string }[];
  /** Locations that can still be connected to this one (no `connected_to` yet). */
  connectCandidates: { id: string; name: string }[];
  canEdit: boolean;
  onChangeIcon: (icon: string) => void;
  onChangeColor: (color: string) => void;
  onSetParent: (locationId: string) => void;
  onRemoveParent: () => void;
  onAddChild: (locationId: string) => void;
  onRemoveRelation: (relationId: string) => void;
  onAddConnection: (locationId: string) => void;
  onRemoveConnection: (relationId: string) => void;
  onRemoveNode: () => void;
  onOpenLocation: () => void;
  onClose: () => void;
}

/**
 * Sheet for a location point: edit its icon/colour, manage its real structure relations (parent,
 * children and connections - the same relations the Location Relation manager owns) and remove
 * the point from the map.
 */
const LocationMapNodeSheet: React.FC<Props> = ({
  name,
  summary,
  icon,
  color,
  parent,
  childLocations,
  connections,
  parentCandidates,
  childCandidates,
  connectCandidates,
  canEdit,
  onChangeIcon,
  onChangeColor,
  onSetParent,
  onRemoveParent,
  onAddChild,
  onRemoveRelation,
  onAddConnection,
  onRemoveConnection,
  onRemoveNode,
  onOpenLocation,
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
    openRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 12,
      paddingVertical: 8,
    },
    openText: { color: colors.primary, fontSize: 15, fontWeight: '600', marginLeft: 6 },
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
    summaryText: { color: colors.text, fontSize: 13, lineHeight: 19 },
    removeButton: { marginTop: 16, backgroundColor: colors.error },
    colorMarging: { marginBottom: 20 },
  });

  const relationRow = (relationId: string, label: string, onRemove: (() => void) | undefined) => (
    <View key={relationId} style={styles.item}>
      <Text style={styles.itemText}>{label}</Text>
      {canEdit && onRemove && (
        <TouchableOpacity onPress={onRemove} accessibilityLabel={t('delete')}>
          <Ionicons name="close-circle" size={18} color={colors.error} />
        </TouchableOpacity>
      )}
    </View>
  );

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
      <TouchableOpacity style={styles.openRow} onPress={onOpenLocation}>
        <Ionicons name="open-outline" size={18} color={colors.primary} />
        <Text style={styles.openText}>{t('location_map_open_location')}</Text>
      </TouchableOpacity>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {summary && (
          <View style={cardStyles.cardContainer}>
            <Text style={[cardStyles.cardText, styles.cardTitle]}>
              {t('location_map_location_summary')}
            </Text>
            {summary.details ? (
              <Text style={styles.summaryText}>{summary.details}</Text>
            ) : (
              <Text style={styles.hint}>{t('common_na')}</Text>
            )}
          </View>
        )}

        {canEdit && (
          <>
            <Text style={styles.section}>{t('location_map_node_icon')}</Text>
            <IconPickerInput
              currentIcon={icon}
              onSelectIcon={onChangeIcon}
              placeholder={t('location_map_node_icon')}
              iconOptions={MAP_ICON_OPTIONS as readonly (keyof typeof Ionicons.glyphMap)[]}
            />
            <Text style={styles.section}>{t('location_map_node_color')}</Text>
            <ColorPickerInput
              currentColor={color}
              onSelectColor={onChangeColor}
              placeholder={t('location_map_node_color')}
              style={styles.colorMarging}
            />
          </>
        )}

        <View style={cardStyles.cardContainer}>
          <Text style={[cardStyles.cardText, styles.cardTitle]}>{t('parent_location')}</Text>
          {parent ? (
            relationRow(parent.relationId, parent.name, canEdit ? onRemoveParent : undefined)
          ) : (
            <Text style={styles.hint}>{t('no_parent_location')}</Text>
          )}
          {canEdit && parentCandidates.length > 0 && (
            <MultiSelectPill
              options={parentCandidates.map((candidate) => ({
                label: candidate.name,
                value: candidate.id,
              }))}
              selectedValues={[]}
              onSelectionChange={(values) => {
                const next = values[0];
                if (next) onSetParent(next);
              }}
              singleSelect
              placeholder={t('set_parent')}
            />
          )}
        </View>

        <View style={cardStyles.cardContainer}>
          <Text style={[cardStyles.cardText, styles.cardTitle]}>{t('child_locations')}</Text>
          {childLocations.length === 0 ? (
            <Text style={styles.hint}>{t('no_child_locations')}</Text>
          ) : (
            childLocations.map((child) =>
              relationRow(
                child.relationId,
                child.name,
                canEdit ? () => onRemoveRelation(child.relationId) : undefined,
              ),
            )
          )}
          {canEdit && childCandidates.length > 0 && (
            <MultiSelectPill
              options={childCandidates.map((candidate) => ({
                label: candidate.name,
                value: candidate.id,
              }))}
              selectedValues={[]}
              onSelectionChange={(values) => {
                const next = values[0];
                if (next) onAddChild(next);
              }}
              singleSelect
              placeholder={t('add_child_location')}
            />
          )}
        </View>

        <View style={cardStyles.cardContainer}>
          <Text style={[cardStyles.cardText, styles.cardTitle]}>{t('connected_locations')}</Text>
          {connections.length === 0 ? (
            <Text style={styles.hint}>{t('no_connected_locations')}</Text>
          ) : (
            connections.map((connection) =>
              relationRow(
                connection.relationId,
                connection.otherName,
                canEdit ? () => onRemoveConnection(connection.relationId) : undefined,
              ),
            )
          )}
          {canEdit && connectCandidates.length > 0 && (
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
              placeholder={t('add_connection')}
            />
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
