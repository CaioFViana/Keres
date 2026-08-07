import React from 'react';
import { useTranslation } from 'react-i18next';
import { Dimensions, FlatList, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { LocationSelect } from '../../db/schema';
import { useTheme } from '../../theme';
import Button from '../common/Button/Button';

interface LocationPickerModalProps {
  isVisible: boolean;
  onClose: () => void;
  onSelect: (locationId: string) => void;
  title: string;
  candidates: LocationSelect[];
}

/** Picker genérico de Location, reaproveitado pelos 3 tipos de ação em LocationRelationManager
 *  (definir pai, adicionar filho, adicionar conexão) - só muda a lista de candidatos já filtrada
 *  pelo chamador (auto-referência/ciclo/já-conectado excluídos antes de chegar aqui). */
const LocationPickerModal: React.FC<LocationPickerModalProps> = ({ isVisible, onClose, onSelect, title, candidates }) => {
  const { colors } = useTheme();
  const { t } = useTranslation();

  const sortedCandidates = [...candidates].sort((a, b) => a.name.localeCompare(b.name));

  const styles = StyleSheet.create({
    modalOverlay: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
    },
    modalContent: {
      backgroundColor: colors.background,
      borderRadius: 10,
      width: Dimensions.get('window').width * 0.85,
      maxHeight: Dimensions.get('window').height * 0.7,
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
    <Modal visible={isVisible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={onClose}>
        <View style={styles.modalContent} onStartShouldSetResponder={() => true}>
          <Text style={styles.title}>{title}</Text>
          <FlatList
            data={sortedCandidates}
            keyExtractor={(item) => item.id}
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
        </View>
      </TouchableOpacity>
    </Modal>
  );
};

export default LocationPickerModal;
