import Button from '@/src/components/common/controls/Button/Button';
import FormActions from '@/src/components/common/controls/FormActions/FormActions';
import { SingleSelectPill } from '@/src/components/common/inputs/MultiSelectPill/MultiSelectPill';
import TextInput from '@/src/components/common/inputs/TextInput/TextInput';
import ResponsiveModal from '@/src/components/layout/ResponsiveModal/ResponsiveModal';
import type { PlotScene } from '@keres/shared/entities/PlotScene';
import { PLOT_SCENE_NOTE_MAX_LENGTH } from '@keres/shared/entities/PlotScene';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTheme, type ThemeColors } from '../../../../theme';
import { useThemedStyles } from '../../../../theme/useThemedStyles';
import { typography } from '../../../../theme/tokens';
import { useVocabularyEntityCopy } from '../../../../vocabulary/useVocabularyEntityCopy';
import { getCommonInputStyles } from '../../../../theme/commonStyles';

interface SceneOption {
  id: string;
  label: string;
}

interface ScenePlotModalProps {
  isVisible: boolean;
  onClose: () => void;
  onSave: (sceneId: string, note: string, relationId?: string) => void;
  initialRelation: PlotScene | null;
  availableScenes: SceneOption[];
  allScenes: SceneOption[];
}

/** The plot editor owns this relation: choose a scene and describe its role in the plot. */
const ScenePlotModal: React.FC<ScenePlotModalProps> = ({
  isVisible,
  onClose,
  onSave,
  initialRelation,
  availableScenes,
  allScenes,
}) => {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const sceneCopy = useVocabularyEntityCopy('Scene');
  const commonInputStyles = getCommonInputStyles(colors);
  const [sceneId, setSceneId] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [errors, setErrors] = useState<{ sceneId?: string; note?: string }>({});

  const [prevInitialRelation, setPrevInitialRelation] = useState<
    typeof initialRelation | undefined
  >(undefined);
  const [prevIsVisible, setPrevIsVisible] = useState<boolean | null>(null);
  if (initialRelation !== prevInitialRelation || isVisible !== prevIsVisible) {
    setPrevInitialRelation(initialRelation);
    setPrevIsVisible(isVisible);
    setSceneId(initialRelation?.sceneId ?? null);
    setNote(initialRelation?.note ?? '');
    setErrors({});
  }

  const selectableScenes = useMemo(
    () =>
      [
        ...availableScenes,
        ...allScenes.filter((scene) => scene.id === initialRelation?.sceneId),
      ].sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' })),
    [allScenes, availableScenes, initialRelation?.sceneId],
  );

  const handleSave = () => {
    const trimmedNote = note.trim();
    const nextErrors: { sceneId?: string; note?: string } = {};
    if (!sceneId) nextErrors.sceneId = sceneCopy.required;
    if (!trimmedNote) nextErrors.note = t('plot_scene_note_required');
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    onSave(sceneId!, trimmedNote, initialRelation?.id);
    onClose();
  };

  const styles = useThemedStyles(createStyles);

  return (
    <ResponsiveModal visible={isVisible} onClose={onClose} inset="roomy" maxHeight="86%">
      <Text style={styles.modalTitle}>
        {initialRelation ? t('edit_plot_scene_relation') : t('add_scene_to_plot')}
      </Text>
      <ScrollView keyboardShouldPersistTaps="handled">
        <View style={styles.formGroup}>
          <Text style={styles.label}>{sceneCopy.entity}</Text>
          <SingleSelectPill
            options={selectableScenes.map((scene) => ({ label: scene.label, value: scene.id }))}
            value={sceneId}
            onValueChange={setSceneId}
            placeholder={sceneCopy.select}
            multiple={false}
            allowDeselect
          />
          {errors.sceneId ? <Text style={styles.errorText}>{errors.sceneId}</Text> : null}
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>{t('plot_scene_note')}</Text>
          <TextInput
            value={note}
            onChangeText={(value) => setNote(value.replace(/[\r\n]+/g, ' '))}
            placeholder={t('plot_scene_note_placeholder')}
            style={commonInputStyles.input}
            maxLength={PLOT_SCENE_NOTE_MAX_LENGTH}
          />
          <Text style={styles.counter}>{`${note.length}/${PLOT_SCENE_NOTE_MAX_LENGTH}`}</Text>
          {errors.note ? <Text style={styles.errorText}>{errors.note}</Text> : null}
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
    modalTitle: {
      ...typography.heading,
      color: colors.text,
      marginBottom: 20,
      textAlign: 'center',
    },
    // The focus ring of shared inputs extends a couple of pixels beyond the field. This is the
    // same breathing room used by the other form modals, so it is never clipped by this surface.
    formGroup: { marginBottom: 15, paddingHorizontal: 2, paddingVertical: 2 },
    label: { ...typography.bodyLarge, color: colors.text, marginBottom: 5 },
    counter: {
      ...typography.caption,
      color: colors.textSecondary,
      marginTop: 5,
      textAlign: 'right',
    },
    errorText: { ...typography.caption, color: colors.error, marginTop: 5 },
  });

export default ScenePlotModal;
