import { MAX_SKETCH_DESCRIPTION_LENGTH, MAX_SKETCH_TITLE_LENGTH } from '@keres/shared';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import Button from '@/src/components/common/controls/Button/Button';
import TextInput from '@/src/components/common/inputs/TextInput/TextInput';
import ResponsiveModal from '@/src/components/layout/ResponsiveModal/ResponsiveModal';
import { getCommonInputStyles } from '@/src/theme/commonStyles';
import { useTheme } from '../../../theme';

interface Props {
  visible: boolean;
  initialValues?: { name: string; description: string | null };
  title?: string;
  confirmLabel?: string;
  onCancel: () => void;
  onConfirm: (name: string, description: string | null) => void;
}

/** Name + optional description for a new sketch, mirroring the board create modal. */
const SketchCreateModal: React.FC<Props> = ({
  visible,
  initialValues,
  title,
  confirmLabel,
  onCancel,
  onConfirm,
}) => {
  const { t } = useTranslation();
  const { colors } = useTheme();
  // Only the two fields are used, and `initialValues` is a fresh object per render of
  // the parent. Resetting the editors when the modal opens keeps typing intact while it
  // stays open.
  const initialName = initialValues?.name ?? '';
  const initialDescription = initialValues?.description ?? '';
  const [prevVisible, setPrevVisible] = useState<boolean | null>(null);
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription);
  if (visible !== prevVisible) {
    setPrevVisible(visible);
    if (visible) {
      setName(initialName);
      setDescription(initialDescription);
    }
  }
  const styles = StyleSheet.create({
    sheet: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: 16,
      borderTopRightRadius: 16,
      paddingHorizontal: 20,
      paddingTop: 16,
      paddingBottom: 24,
    },
    title: {
      color: colors.text,
      fontSize: 19,
      fontWeight: 'bold',
      marginBottom: 12,
    },
    label: { fontSize: 16, fontWeight: 'bold', color: colors.text, marginBottom: 5 },
    actions: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      gap: 12,
      marginTop: 18,
    },
  });
  return (
    <ResponsiveModal visible={visible} onClose={onCancel} placement="adaptive" contentStyle={styles.sheet}>
      <Text style={styles.title}>{title ?? t('sketch_create_title')}</Text>
      <Text style={styles.label}>{t('sketch_name')}</Text>
      <TextInput
        value={name}
        onChangeText={setName}
        placeholder={t('sketch_name_placeholder')}
        maxLength={MAX_SKETCH_TITLE_LENGTH}
      />
      <Text style={styles.label}>{t('sketch_description')}</Text>
      <TextInput
        value={description}
        onChangeText={setDescription}
        placeholder={t('sketch_description_placeholder')}
        maxLength={MAX_SKETCH_DESCRIPTION_LENGTH}
        multiline
        numberOfLines={5}
        style={getCommonInputStyles(colors).multiline}
      />
      <View style={styles.actions}>
        <Button onPress={onCancel}>{t('cancel')}</Button>
        <Button
          onPress={() => onConfirm(name.trim(), description.trim() || null)}
          disabled={!name.trim()}
        >
          {confirmLabel ?? t('add')}
        </Button>
      </View>
    </ResponsiveModal>
  );
};

export default SketchCreateModal;
