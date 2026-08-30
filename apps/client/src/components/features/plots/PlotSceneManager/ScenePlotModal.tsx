import Button from '@/src/components/common/controls/Button/Button';
import FormActions from '@/src/components/common/controls/FormActions/FormActions';
import Select from '@/src/components/common/inputs/Select/Select';
import TextInput from '@/src/components/common/inputs/TextInput/TextInput';
import ResponsiveModal from '@/src/components/layout/ResponsiveModal/ResponsiveModal';
import type { PlotScene } from '@keres/shared/entities/PlotScene';
import { PLOT_SCENE_NOTE_MAX_LENGTH } from '@keres/shared/entities/PlotScene';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../../../theme';
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
  const commonInputStyles = getCommonInputStyles(colors);
  const [sceneId, setSceneId] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [errors, setErrors] = useState<{ sceneId?: string; note?: string }>({});

  useEffect(() => {
    setSceneId(initialRelation?.sceneId ?? null);
    setNote(initialRelation?.note ?? '');
    setErrors({});
  }, [initialRelation, isVisible]);

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
    if (!sceneId) nextErrors.sceneId = t('scene_required');
    if (!trimmedNote) nextErrors.note = t('plot_scene_note_required');
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    onSave(sceneId!, trimmedNote, initialRelation?.id);
    onClose();
  };

  const styles = StyleSheet.create({
    modalContent: { backgroundColor: colors.background, borderRadius: 10, padding: 20 },
    modalTitle: {
      fontSize: 20,
      fontWeight: 'bold',
      color: colors.text,
      marginBottom: 20,
      textAlign: 'center',
    },
    // The focus ring of shared inputs extends a couple of pixels beyond the field. This is the
    // same breathing room used by the other form modals, so it is never clipped by this surface.
    formGroup: { marginBottom: 15, paddingHorizontal: 2, paddingVertical: 2 },
    label: { fontSize: 16, color: colors.text, marginBottom: 5 },
    counter: { color: colors.textSecondary, fontSize: 12, marginTop: 5, textAlign: 'right' },
    errorText: { color: colors.error, fontSize: 12, marginTop: 5 },
  });

  return (
    <ResponsiveModal
      visible={isVisible}
      onClose={onClose}
      contentStyle={styles.modalContent}
      maxHeight="86%"
    >
      <Text style={styles.modalTitle}>
        {initialRelation ? t('edit_plot_scene_relation') : t('add_scene_to_plot')}
      </Text>
      <ScrollView keyboardShouldPersistTaps="handled">
        <View style={styles.formGroup}>
          <Text style={styles.label}>{t('scene')}</Text>
          <Select
            options={selectableScenes.map((scene) => ({ label: scene.label, value: scene.id }))}
            value={sceneId}
            onValueChange={setSceneId}
            placeholder={t('select_scene')}
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

export default ScenePlotModal;
