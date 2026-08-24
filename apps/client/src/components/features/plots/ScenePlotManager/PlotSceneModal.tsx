import Button from '@/src/components/common/controls/Button/Button';
import Select from '@/src/components/common/inputs/Select/Select';
import TextInput from '@/src/components/common/inputs/TextInput/TextInput';
import ResponsiveModal from '@/src/components/layout/ResponsiveModal/ResponsiveModal';
import { Plot } from '@keres/shared/entities/Plot';
import { PLOT_SCENE_NOTE_MAX_LENGTH, PlotScene } from '@keres/shared/entities/PlotScene';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../../../theme';
import { getCommonInputStyles } from '../../../../theme/commonStyles';

interface PlotSceneModalProps {
  isVisible: boolean;
  onClose: () => void;
  onSave: (plotId: string, note: string, relationId?: string) => void;
  initialRelation: PlotScene | null;
  /** Tramas que ainda podem ser escolhidas; a da relação em edição entra à parte. */
  availablePlots: Plot[];
  allPlots: Plot[];
}

/**
 * Escolher a trama e escrever a nota de uma linha. Editar troca a trama ou reescreve a nota -
 * a unicidade (uma relação por par trama/cena) é garantida pela lista de tramas disponíveis
 * e, em último caso, pelo serviço.
 */
const PlotSceneModal: React.FC<PlotSceneModalProps> = ({
  isVisible,
  onClose,
  onSave,
  initialRelation,
  availablePlots,
  allPlots,
}) => {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const commonInputStyles = getCommonInputStyles(colors);

  const [plotId, setPlotId] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [errors, setErrors] = useState<{ plotId?: string; note?: string }>({});

  useEffect(() => {
    setPlotId(initialRelation?.plotId ?? null);
    setNote(initialRelation?.note ?? '');
    setErrors({});
  }, [initialRelation, isVisible]);

  const selectablePlots = [
    ...availablePlots,
    ...allPlots.filter((plot) => plot.id === initialRelation?.plotId),
  ].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));

  const handleSave = () => {
    const trimmedNote = note.trim();
    const nextErrors: { plotId?: string; note?: string } = {};
    if (!plotId) nextErrors.plotId = t('plot_required');
    if (!trimmedNote) nextErrors.note = t('plot_scene_note_required');
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    onSave(plotId!, trimmedNote, initialRelation?.id);
    onClose();
  };

  const styles = StyleSheet.create({
    modalContent: {
      backgroundColor: colors.background,
      borderRadius: 10,
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
    counter: {
      color: colors.textSecondary,
      fontSize: 12,
      marginTop: 5,
      textAlign: 'right',
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
  });

  return (
    <ResponsiveModal
      visible={isVisible}
      onClose={onClose}
      contentStyle={styles.modalContent}
      maxHeight="86%"
    >
      <Text style={styles.modalTitle}>
        {initialRelation ? t('edit_plot_scene_relation') : t('add_plot_scene_relation')}
      </Text>
      <ScrollView keyboardShouldPersistTaps="handled">
        <View style={styles.formGroup}>
          <Text style={styles.label}>{t('plot_name')}</Text>
          <Select
            options={selectablePlots.map((plot) => ({ label: plot.name, value: plot.id }))}
            value={plotId}
            onValueChange={setPlotId}
            placeholder={t('select_plot')}
            multiple={false}
            allowDeselect
          />
          {errors.plotId && <Text style={styles.errorText}>{errors.plotId}</Text>}
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>{t('plot_scene_note')}</Text>
          <TextInput
            value={note}
            // Uma linha por regra do modelo: a nota diz o papel da cena na trama, e uma quebra
            // de linha aqui chegaria à matriz e ao detalhe como texto cortado.
            onChangeText={(value) => setNote(value.replace(/[\r\n]+/g, ' '))}
            placeholder={t('plot_scene_note_placeholder')}
            style={commonInputStyles.input}
            maxLength={PLOT_SCENE_NOTE_MAX_LENGTH}
          />
          <Text style={styles.counter}>{`${note.length}/${PLOT_SCENE_NOTE_MAX_LENGTH}`}</Text>
          {errors.note && <Text style={styles.errorText}>{errors.note}</Text>}
        </View>
      </ScrollView>

      <View style={styles.buttonContainer}>
        <Button onPress={onClose}>{t('cancel')}</Button>
        <Button onPress={handleSave}>{t('save_changes')}</Button>
      </View>
    </ResponsiveModal>
  );
};

export default PlotSceneModal;
