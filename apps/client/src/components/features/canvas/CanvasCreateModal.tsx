import Button from '@/src/components/common/controls/Button/Button';
import TextInput from '@/src/components/common/inputs/TextInput/TextInput';
import ResponsiveModal from '@/src/components/layout/ResponsiveModal/ResponsiveModal';
import { getCommonInputStyles } from '@/src/theme/commonStyles';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { type ThemeColors, useTheme } from '../../../theme';
import { typography } from '../../../theme/tokens';
import { useThemedStyles } from '../../../theme/useThemedStyles';

export interface CanvasCreateModalProps {
  visible: boolean;
  initialValues?: { name: string; description: string | null };
  title: string;
  descriptionPlaceholder: string;
  confirmLabel?: string;
  onCancel: () => void;
  onConfirm: (name: string, description: string | null) => void;
}

/** Name and description form shared by the canvas (board, location map) create modals. */
const CanvasCreateModal: React.FC<CanvasCreateModalProps> = ({
  visible,
  initialValues,
  title,
  descriptionPlaceholder,
  confirmLabel,
  onCancel,
  onConfirm,
}) => {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const commonInputStyles = getCommonInputStyles(colors);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  // Only the two fields are used, and `initialValues` is a fresh object per render of
  // whoever owns it: tracking it by identity would loop forever.
  const initialName = initialValues?.name ?? '';
  const initialDescription = initialValues?.description ?? '';
  const [prevInitialName, setPrevInitialName] = useState<string | null>(null);
  const [prevInitialDescription, setPrevInitialDescription] = useState<string | null>(null);
  const [prevVisible, setPrevVisible] = useState<boolean | null>(null);
  if (
    visible !== prevVisible ||
    initialName !== prevInitialName ||
    initialDescription !== prevInitialDescription
  ) {
    setPrevVisible(visible);
    setPrevInitialName(initialName);
    setPrevInitialDescription(initialDescription);
    if (visible) {
      setName(initialName);
      setDescription(initialDescription);
    }
  }

  const styles = useThemedStyles(createStyles);

  return (
    <ResponsiveModal
      visible={visible}
      onClose={onCancel}
      tone="raised"
      inset="roomy"
      maxHeight="86%"
    >
      <Text style={styles.title}>{title}</Text>
      <View style={styles.field}>
        <Text style={styles.label}>{t('name')}</Text>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder={t('name_placeholder')}
          style={commonInputStyles.input}
        />
      </View>
      <View style={styles.field}>
        <Text style={styles.label}>{t('description')}</Text>
        <TextInput
          value={description}
          onChangeText={setDescription}
          placeholder={descriptionPlaceholder}
          style={commonInputStyles.input}
        />
      </View>
      <View style={styles.buttons}>
        <View style={styles.buttonWrapper}>
          <Button onPress={onCancel}>{t('cancel')}</Button>
        </View>
        <View style={styles.buttonWrapper}>
          <Button
            disabled={!name.trim()}
            onPress={() => onConfirm(name.trim(), description.trim() || null)}
          >
            {confirmLabel ?? t('add')}
          </Button>
        </View>
      </View>
    </ResponsiveModal>
  );
};

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    title: {
      ...typography.heading,
      color: colors.text,
      marginBottom: 16,
      textAlign: 'center',
    },
    label: { ...typography.sectionTitle, color: colors.text, marginBottom: 5 },
    field: { marginBottom: 12 },
    buttons: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: 8,
    },
    buttonWrapper: { width: '47%' },
  });

export default CanvasCreateModal;
