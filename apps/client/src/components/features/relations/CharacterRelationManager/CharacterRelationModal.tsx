import FormActions from '@/src/components/common/controls/FormActions/FormActions';
import { Ionicons } from '@expo/vector-icons';
import type { Character } from '@keres/shared/entities/Character';
import type { CharacterRelation } from '@keres/shared/entities/CharacterRelation';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTheme, type ThemeColors } from '../../../../theme';
import { useThemedStyles } from '../../../../theme/useThemedStyles';
import { typography } from '../../../../theme/tokens';
import { useVocabularyEntityCopy } from '../../../../vocabulary/useVocabularyEntityCopy';
import Button from '@/src/components/common/controls/Button/Button';
import SuggestionTextInput from '@/src/components/common/inputs/SuggestionTextInput/SuggestionTextInput';
import ResponsiveModal from '@/src/components/layout/ResponsiveModal/ResponsiveModal';
import ModalHeader from '@/src/components/layout/ModalHeader/ModalHeader';

interface CharacterRelationModalProps {
  isVisible: boolean;
  onClose: () => void;
  onSave: (relatedCharId: string, relationType: string, relationId?: string) => void;
  initialRelation: CharacterRelation | null;
  characters: Character[];
  currentStoryId: string;
  currentCharacterId: string;
  /** Characters that already have a relation with the current one - excluded from the
   * picker so a second relation for the same pair can't be created. */
  relatedCharacterIds: string[];
}

const CharacterRelationModal: React.FC<CharacterRelationModalProps> = ({
  isVisible,
  onClose,
  onSave,
  initialRelation,
  characters,
  currentStoryId,
  currentCharacterId,
  relatedCharacterIds,
}) => {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const characterCopy = useVocabularyEntityCopy('Character');

  const [relatedCharId, setRelatedCharId] = useState<string>('');
  const [relationType, setRelationType] = useState<string>('');
  const [errors, setErrors] = useState<{ relatedCharId?: string; relationType?: string }>({});
  const [showCharacterPicker, setShowCharacterPicker] = useState(false);

  const [prevInitialRelation, setPrevInitialRelation] = useState<
    typeof initialRelation | undefined
  >(undefined);
  const [prevIsVisible, setPrevIsVisible] = useState<boolean | null>(null);
  const [prevCurrentCharacterId, setPrevCurrentCharacterId] = useState<
    typeof currentCharacterId | null
  >(null);
  if (
    initialRelation !== prevInitialRelation ||
    isVisible !== prevIsVisible ||
    currentCharacterId !== prevCurrentCharacterId
  ) {
    setPrevInitialRelation(initialRelation);
    setPrevIsVisible(isVisible);
    setPrevCurrentCharacterId(currentCharacterId);
    if (initialRelation) {
      const relatedId =
        initialRelation.character1Id === currentCharacterId
          ? initialRelation.character2Id
          : initialRelation.character1Id;
      setRelatedCharId(relatedId);
      setRelationType(initialRelation.relationType);
    } else {
      setRelatedCharId('');
      setRelationType('');
    }
    setErrors({});
  }

  const validate = () => {
    const newErrors: { relatedCharId?: string; relationType?: string } = {};
    if (!relatedCharId) newErrors.relatedCharId = t('related_character_required');
    if (!relationType) newErrors.relationType = t('relation_type_required');
    if (relatedCharId && relatedCharId === currentCharacterId)
      newErrors.relatedCharId = t('cannot_relate_self');
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
    return characters.find((char) => char.id === charId)?.name || characterCopy.select;
  };

  const relatedCharacterIdSet = new Set(relatedCharacterIds);
  const selectableCharacters = characters
    .filter((char) => char.id !== currentCharacterId && !relatedCharacterIdSet.has(char.id))
    .sort((a, b) => a.name.localeCompare(b.name));

  const handleSelectCharacter = (charId: string) => {
    setRelatedCharId(charId);
    setShowCharacterPicker(false);
  };

  const styles = useThemedStyles(createStyles);

  return (
    <ResponsiveModal visible={isVisible} onClose={onClose} inset="roomy" maxHeight="86%">
      <ModalHeader
        title={initialRelation ? t('edit_character_relation') : t('add_character_relation_title')}
      />
      <ScrollView keyboardShouldPersistTaps="handled">
        <View style={styles.formGroup}>
          <Text style={styles.label}>{t('related_character')}</Text>
          <TouchableOpacity
            style={[styles.pickerContainer, initialRelation && { opacity: 0.6 }]}
            onPress={initialRelation ? undefined : () => setShowCharacterPicker(true)}
            disabled={!!initialRelation}
          >
            <Text style={styles.pickerText}>
              {relatedCharId ? getCharacterName(relatedCharId) : characterCopy.select}
            </Text>
            <Ionicons
              name="caret-down"
              size={20}
              color={colors.textSecondary}
              style={styles.pickerButton}
            />
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

      <FormActions>
        <Button onPress={onClose}>{t('cancel')}</Button>
        <Button onPress={handleSave}>{t('save_changes')}</Button>
      </FormActions>
      <ResponsiveModal
        visible={showCharacterPicker}
        onClose={() => setShowCharacterPicker(false)}
        inset="compact"
        maxHeight="78%"
      >
        <FlatList
          data={selectableCharacters}
          keyExtractor={(item) => item.id}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.characterPickerItem}
              onPress={() => handleSelectCharacter(item.id)}
            >
              <Text style={styles.characterPickerText}>{item.name}</Text>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <Text style={styles.noCharactersText}>{t('no_characters_found')}</Text>
          }
        />
        <Button onPress={() => setShowCharacterPicker(false)} style={styles.closeButton}>
          {t('close')}
        </Button>
      </ResponsiveModal>
    </ResponsiveModal>
  );
};

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    formGroup: {
      marginBottom: 15,
    },
    label: {
      ...typography.bodyLarge,
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
      ...typography.bodyLarge,
      flex: 1,
      color: colors.text,
      paddingVertical: 8,
    },
    errorText: {
      ...typography.caption,
      color: colors.error,
      marginTop: 5,
    },
    buttonContainer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: 20,
      paddingHorizontal: '3%',
    },
    characterPickerItem: {
      paddingVertical: 10,
      paddingHorizontal: 15,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    characterPickerText: {
      ...typography.bodyLarge,
      color: colors.text,
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

export default CharacterRelationModal;
