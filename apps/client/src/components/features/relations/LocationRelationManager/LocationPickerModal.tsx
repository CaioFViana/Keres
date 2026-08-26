import React from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, StyleSheet, Text, TouchableOpacity } from 'react-native';
import type { LocationSelect } from '../../../../db/schema';
import { useTheme } from '../../../../theme';
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
  const { colors } = useTheme();
  const { t } = useTranslation();

  const sortedCandidates = [...candidates].sort((a, b) => a.name.localeCompare(b.name));

  const styles = StyleSheet.create({
    modalContent: {
      backgroundColor: colors.background,
      borderRadius: 10,
      padding: 15,
    },
    title: {
      fontSize: 18,
      fontWeight: 'bold',
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
      color: colors.text,
      fontSize: 16,
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

  return (
    <ResponsiveModal
      visible={isVisible}
      onClose={onClose}
      contentStyle={styles.modalContent}
      maxHeight="78%"
    >
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

export default LocationPickerModal;
