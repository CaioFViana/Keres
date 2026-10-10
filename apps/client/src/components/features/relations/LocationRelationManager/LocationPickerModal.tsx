import React from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, StyleSheet, Text, TouchableOpacity } from 'react-native';
import type { LocationSelect } from '../../../../db/schema';
import type { ThemeColors } from '../../../../theme';
import { useThemedStyles } from '../../../../theme/useThemedStyles';
import { typography } from '../../../../theme/tokens';
import Button from '@/src/components/common/controls/Button/Button';
import ResponsiveModal from '@/src/components/layout/ResponsiveModal/ResponsiveModal';

interface LocationPickerModalProps {
  isVisible: boolean;
  onClose: () => void;
  onSelect: (locationId: string) => void;
  title: string;
  candidates: LocationSelect[];
}

/**
 * A generic Location picker, reused by the 3 kinds of action in LocationRelationManager (set a parent,
 * add a child, add a connection) - only the candidate list differs, already filtered by the caller
 * (self-reference/cycle/already-connected excluded before reaching here).
 */
const LocationPickerModal: React.FC<LocationPickerModalProps> = ({
  isVisible,
  onClose,
  onSelect,
  title,
  candidates,
}) => {
  const { t } = useTranslation();

  const sortedCandidates = [...candidates].sort((a, b) => a.name.localeCompare(b.name));

  const styles = useThemedStyles(createStyles);

  return (
    <ResponsiveModal visible={isVisible} onClose={onClose} inset="regular" maxHeight="78%">
      <Text style={styles.title}>{title}</Text>
      <FlatList
        data={sortedCandidates}
        keyExtractor={(item) => item.id}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.item} onPress={() => onSelect(item.id)}>
            <Text style={styles.itemText}>{item.name}</Text>
          </TouchableOpacity>
        )}
        ListEmptyComponent={<Text style={styles.emptyText}>{t('no_locations_available')}</Text>}
      />
      <Button onPress={onClose} style={styles.closeButton}>
        {t('close')}
      </Button>
    </ResponsiveModal>
  );
};

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    title: {
      ...typography.title,
      color: colors.text,
      marginBottom: 10,
      textAlign: 'center',
    },
    item: {
      paddingVertical: 12,
      paddingHorizontal: 10,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    itemText: {
      ...typography.bodyLarge,
      color: colors.text,
    },
    emptyText: {
      color: colors.textSecondary,
      textAlign: 'center',
      paddingVertical: 20,
    },
    closeButton: {
      marginTop: 15,
      alignSelf: 'flex-end',
    },
  });

export default LocationPickerModal;
