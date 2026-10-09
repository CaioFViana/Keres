import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Button from '@/src/components/common/controls/Button/Button';
import { SingleSelectPill } from '@/src/components/common/inputs/MultiSelectPill/MultiSelectPill';
import ModalHeader from '@/src/components/layout/ModalHeader/ModalHeader';
import ResponsiveModal from '@/src/components/layout/ResponsiveModal/ResponsiveModal';
import { useTheme } from '../../../theme';
import { space } from '../../../theme/tokens';

interface TrajectoryPickerSheetProps {
  characters: { id: string; name: string }[];
  items: { id: string; name: string }[];
  routes: { id: string; name: string }[];
  storyType: 'linear' | 'branching' | undefined;
  selectedCharacterIds: string[];
  selectedItemIds: string[];
  routeId: string | null;
  onToggleCharacter: (id: string) => void;
  onToggleItem: (id: string) => void;
  onSelectRoute: (id: string | null) => void;
  onClear: () => void;
  onClose: () => void;
}

/** Picks which character/item trajectories a map draws. The selection never persists. */
const TrajectoryPickerSheet: React.FC<TrajectoryPickerSheetProps> = ({
  characters,
  items,
  routes,
  storyType,
  selectedCharacterIds,
  selectedItemIds,
  routeId,
  onToggleCharacter,
  onToggleItem,
  onSelectRoute,
  onClear,
  onClose,
}) => {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = StyleSheet.create({
    sheet: { maxHeight: '78%' },
    scroll: { flexShrink: 1 },
    scrollContent: { paddingHorizontal: 22, paddingTop: 2, paddingBottom: 24 },
    // The sheet has no padding of its own: the header and the scroll body lay out their inset.
    header: { paddingHorizontal: space.xxl, paddingTop: space.xl, paddingBottom: space.md },
    section: {
      color: colors.text,
      fontSize: 13,
      fontWeight: '700',
      marginTop: 14,
      marginBottom: 6,
    },
    row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
    rowLabel: { color: colors.text, flex: 1 },
    hint: { color: colors.textSecondary, marginTop: 4 },
    clear: { marginTop: 20 },
  });

  const renderRows = (
    entries: { id: string; name: string }[],
    selected: string[],
    onToggle: (id: string) => void,
    emptyKey: string,
    testPrefix: string,
  ) =>
    entries.length === 0 ? (
      <Text style={styles.hint}>{t(emptyKey)}</Text>
    ) : (
      entries.map((entry) => {
        const checked = selected.includes(entry.id);
        return (
          <TouchableOpacity
            key={entry.id}
            testID={`${testPrefix}-${entry.id}`}
            style={styles.row}
            onPress={() => onToggle(entry.id)}
            accessibilityLabel={entry.name}
          >
            <Ionicons
              name={checked ? 'checkbox-outline' : 'square-outline'}
              size={22}
              color={checked ? colors.primary : colors.textSecondary}
            />
            <Text style={styles.rowLabel}>{entry.name}</Text>
          </TouchableOpacity>
        );
      })
    );

  return (
    <ResponsiveModal
      visible
      onClose={onClose}
      placement="adaptive"
      tone="raised"
      contentStyle={styles.sheet}
    >
      <View style={styles.header}>
        <ModalHeader title={t('trajectory_title')} onClose={onClose} />
      </View>
      <ScrollView
        testID="trajectory-picker-scroll"
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.section}>{t('trajectory_characters')}</Text>
        {renderRows(
          characters,
          selectedCharacterIds,
          onToggleCharacter,
          'trajectory_no_characters',
          'trajectory-character',
        )}
        <Text style={styles.section}>{t('trajectory_items')}</Text>
        {renderRows(items, selectedItemIds, onToggleItem, 'trajectory_no_items', 'trajectory-item')}
        {storyType === 'branching' && (
          <>
            <Text style={styles.section}>{t('trajectory_route')}</Text>
            {routes.length === 0 ? (
              <Text style={styles.hint}>{t('trajectory_no_routes')}</Text>
            ) : (
              <SingleSelectPill
                options={routes.map((route) => ({ label: route.name, value: route.id }))}
                value={routeId ?? ''}
                onValueChange={(value) => onSelectRoute(value || null)}
                placeholder={t('trajectory_route')}
                multiple={false}
              />
            )}
          </>
        )}
        <View style={styles.clear}>
          <Button onPress={onClear}>{t('trajectory_clear')}</Button>
        </View>
      </ScrollView>
    </ResponsiveModal>
  );
};

export default TrajectoryPickerSheet;
