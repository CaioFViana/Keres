import FormActions from '@/src/components/common/controls/FormActions/FormActions';
import type { Character } from '@keres/shared/entities/narrative/Character';
import type { CharacterRelation } from '@keres/shared/entities/narrative/CharacterRelation';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import type { ThemeColors } from '@/src/theme';
import { useThemedStyles } from '@/src/theme/useThemedStyles';
import { typography } from '@/src/theme/tokens';
import { useVocabularyEntityCopy } from '@/src/hooks/vocabulary/useVocabularyEntityCopy';
import Button from '@/src/components/common/controls/Button/Button';
import { SingleSelectPill } from '@/src/components/common/inputs/MultiSelectPill/MultiSelectPill';
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
  const { t } = useTranslation();
  const characterCopy = useVocabularyEntityCopy('Character');

  const [relatedCharId, setRelatedCharId] = useState<string>('');
  const [relationType, setRelationType] = useState<string>('');
  const [errors, setErrors] = useState<{ relatedCharId?: string; relationType?: string }>({});

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

  const relatedCharacterIdSet = new Set(relatedCharacterIds);
  const selectableCharacters = characters
    .filter((char) => char.id !== currentCharacterId && !relatedCharacterIdSet.has(char.id))
    .sort((a, b) => a.name.localeCompare(b.name));
  // An edited relation keeps its partner, who is by definition already related and so not in the list.
  const characterOptions = (
    initialRelation ? characters.filter((char) => char.id === relatedCharId) : selectableCharacters
  ).map((char) => ({ label: char.name, value: char.id }));

  const styles = useThemedStyles(createStyles);

  return (
    <ResponsiveModal visible={isVisible} onClose={onClose} inset="roomy" maxHeight="86%">
      <ModalHeader
        title={initialRelation ? t('edit_character_relation') : t('add_character_relation_title')}
      />
      <ScrollView keyboardShouldPersistTaps="handled">
        <View style={styles.formGroup}>
          <Text style={styles.label}>{t('related_character')}</Text>
          <SingleSelectPill
            options={characterOptions}
            value={relatedCharId || null}
            onValueChange={(value) => setRelatedCharId(value ?? '')}
            disabled={!!initialRelation}
            placeholder={characterCopy.select}
            noOptionsText={t('no_characters_found')}
          />
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
    errorText: {
      ...typography.caption,
      color: colors.error,
      marginTop: 5,
    },
  });

export default CharacterRelationModal;
