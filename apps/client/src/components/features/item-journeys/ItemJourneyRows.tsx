import { Ionicons } from '@expo/vector-icons';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { ItemJourneySelect, SceneSelect } from '@/src/db/schema';
import { useTheme } from '@/src/theme';

interface ItemJourneyRowsProps {
  journeys: ItemJourneySelect[];
  scenes: SceneSelect[];
  canEdit: boolean;
  onOpenJourney: (journeyId: string) => void;
  onAddJourney: () => void;
}

/** Compact journey outline rendered inside an Item, in the same narrative order as its detail timeline. */
const ItemJourneyRows: React.FC<ItemJourneyRowsProps> = ({
  journeys,
  scenes,
  canEdit,
  onOpenJourney,
  onAddJourney,
}) => {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const sceneById = useMemo(() => new Map(scenes.map((scene) => [scene.id, scene])), [scenes]);
  const styles = useMemo(
    () =>
      StyleSheet.create({
        heading: { flexDirection: 'row', alignItems: 'center', marginTop: 10, marginBottom: 4 },
        title: { flex: 1, fontSize: 12, fontWeight: '700', color: colors.textSecondary },
        add: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 4 },
        addText: { color: colors.primary, fontSize: 12, fontWeight: '700' },
        row: {
          flexDirection: 'row',
          alignItems: 'center',
          paddingVertical: 8,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: colors.border,
        },
        rowText: { flex: 1 },
        scene: { fontSize: 12, color: colors.textSecondary },
        state: { fontSize: 14, color: colors.text, marginTop: 2 },
      }),
    [colors],
  );

  return (
    <View>
      <View style={styles.heading}>
        <Text style={styles.title}>{t('item_journeys_title')}</Text>
        {canEdit && (
          <TouchableOpacity style={styles.add} onPress={onAddJourney}>
            <Ionicons name="add" size={16} color={colors.primary} />
            <Text style={styles.addText}>{t('add_item_journey')}</Text>
          </TouchableOpacity>
        )}
      </View>
      {journeys.map((journey) => (
        <TouchableOpacity
          key={journey.id}
          style={styles.row}
          onPress={() => onOpenJourney(journey.id)}
          activeOpacity={0.7}
        >
          <View style={styles.rowText}>
            <Text style={styles.scene} numberOfLines={1}>
              {sceneById.get(journey.sceneId)?.name ?? t('unknown_scene')}
            </Text>
            <Text style={styles.state} numberOfLines={1}>
              {journey.newState}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
        </TouchableOpacity>
      ))}
    </View>
  );
};

export default ItemJourneyRows;
