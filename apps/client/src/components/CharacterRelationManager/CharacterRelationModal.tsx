import { Ionicons } from '@expo/vector-icons';
import { Character } from '@keres/shared/entities/Character';
import { CharacterRelation } from '@keres/shared/entities/CharacterRelation';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Dimensions, FlatList, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTheme } from '../../theme';
import Button from '../common/Button/Button';
import SuggestionTextInput from '../common/SuggestionTextInput/SuggestionTextInput';

interface CharacterRelationModalProps {
  isVisible: boolean;
  onClose: () => void;
  onSave: (relatedCharId: string, relationType: string, relationId?: string) => void;
  initialRelation: CharacterRelation | null;
  characters: Character[];
  currentStoryId: string;
  currentCharacterId: string;
}

const CharacterRelationModal: React.FC<CharacterRelationModalProps> = ({
  isVisible,
  onClose,
  onSave,
  initialRelation,
  characters,
  currentStoryId,
  currentCharacterId,
}) => {
  const { colors } = useTheme();
  const { t } = useTranslation();

  const [relatedCharId, setRelatedCharId] = useState<string>('');
  const [relationType, setRelationType] = useState<string>('');
  const [errors, setErrors] = useState<{ relatedCharId?: string; relationType?: string }>({});
  const [showCharacterPicker, setShowCharacterPicker] = useState(false);

  useEffect(() => {
    if (initialRelation) {
      const relatedId = initialRelation.charId1 === currentCharacterId
        ? initialRelation.charId2
        : initialRelation.charId1;
      setRelatedCharId(relatedId);
      setRelationType(initialRelation.relationType);
    } else {
      setRelatedCharId('');
      setRelationType('');
    }
    setErrors({});
  }, [initialRelation, isVisible, currentCharacterId]);

  const validate = () => {
    const newErrors: { relatedCharId?: string; relationType?: string } = {};
    if (!relatedCharId) newErrors.relatedCharId = t('related_character_required');
    if (!relationType) newErrors.relationType = t('relation_type_required');
    if (relatedCharId && relatedCharId === currentCharacterId) newErrors.relatedCharId = t('cannot_relate_self');
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = () => {
    if (!validate()) {
      return;
    }
    onSave(relatedCharId, relationType, initialRelation?.id);
    onClose();
  };

  const getCharacterName = (charId: string) => {
    return characters.find(char => char.id === charId)?.name || t('select_character');
  };

  const selectableCharacters = characters
    .filter(char => char.id !== currentCharacterId)
    .sort((a, b) => a.name.localeCompare(b.name));

  const handleSelectCharacter = (charId: string) => {
    setRelatedCharId(charId);
    setShowCharacterPicker(false);
  };

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
      width: '90%',
      maxHeight: '80%',
      padding: 20,
    },
    modalTitle: {
      fontSize: 20,
      fontWeight: 'bold',
      color: colors.text,
      marginBottom: 20,
      textAlign: 'center',
    },
    formGroup: {
      marginBottom: 15,
    },
    label: {
      fontSize: 16,
      color: colors.text,
      marginBottom: 5,
    },
    pickerContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      backgroundColor: colors.card,
      marginBottom: 5,
      paddingHorizontal: 10,
      minHeight: 50,
    },
    pickerButton: {
      paddingLeft: 10,
    },
    pickerText: {
      flex: 1,
      color: colors.text,
      fontSize: 16,
      paddingVertical: 8,
    },
    errorText: {
      color: colors.error,
      fontSize: 12,
      marginTop: 5,
    },
    buttonContainer: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      marginTop: 20,
    },
    characterPickerModalContent: {
      backgroundColor: colors.background,
      borderRadius: 10,
      width: Dimensions.get('window').width * 0.8,
      maxHeight: Dimensions.get('window').height * 0.7,
      padding: 10,
    },
    characterPickerItem: {
      paddingVertical: 10,
      paddingHorizontal: 15,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    characterPickerText: {
      color: colors.text,
      fontSize: 16,
    },
    noCharactersText: {
      color: colors.textSecondary,
      textAlign: 'center',
      paddingVertical: 20,
    },
    closeButton: {
      marginTop: 20,
      alignSelf: 'flex-end',
    },
  });

  return (
    <Modal
      visible={isVisible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={onClose}>
        <View style={styles.modalContent} onStartShouldSetResponder={() => true}>
          <Text style={styles.modalTitle}>
            {initialRelation ? t('edit_character_relation') : t('add_character_relation_title')}
          </Text>
          <ScrollView>
            <View style={styles.formGroup}>
              <Text style={styles.label}>{t('related_character')}</Text>
              <TouchableOpacity
                style={styles.pickerContainer}
                onPress={() => setShowCharacterPicker(true)}
              >
                <Text style={styles.pickerText}>
                  {relatedCharId ? getCharacterName(relatedCharId) : t('select_character')}
                </Text>
                <Ionicons name="caret-down" size={20} color={colors.textSecondary} style={styles.pickerButton} />
              </TouchableOpacity>
              {errors.relatedCharId && <Text style={styles.errorText}>{errors.relatedCharId}</Text>}
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>{t('relation_type')}</Text>
              <SuggestionTextInput
                value={relationType}
                onChangeText={setRelationType}
                type="characterRelation_type"
                storyId={currentStoryId}
                placeholder={t('select_relation_type')}
                style={{ marginBottom: 5 }}
              />
              {errors.relationType && <Text style={styles.errorText}>{errors.relationType}</Text>}
            </View>
          </ScrollView>

          <View style={styles.buttonContainer}>
            <Button onPress={onClose}>
              {t('cancel')}
            </Button>
            <Button onPress={handleSave}>
              {t('save_changes')}
            </Button>
          </View>
        </View>
      </TouchableOpacity>

      <Modal
        visible={showCharacterPicker}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowCharacterPicker(false)}
      >
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowCharacterPicker(false)}>
          <View style={styles.characterPickerModalContent}>
            <FlatList
              data={selectableCharacters}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.characterPickerItem} onPress={() => handleSelectCharacter(item.id)}>
                  <Text style={styles.characterPickerText}>{item.name}</Text>
                </TouchableOpacity>
              )}
              ListEmptyComponent={<Text style={styles.noCharactersText}>{t('no_characters_found')}</Text>}
            />
            <Button onPress={() => setShowCharacterPicker(false)} style={styles.closeButton}>
              {t('close')}
            </Button>
          </View>
        </TouchableOpacity>
      </Modal>
    </Modal>
  );
};

export default CharacterRelationModal;