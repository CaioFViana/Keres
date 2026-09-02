import Button from '@/src/components/common/controls/Button/Button';
import TextInput from '@/src/components/common/inputs/TextInput/TextInput';
import ResponsiveModal from '@/src/components/layout/ResponsiveModal/ResponsiveModal';
import { getCommonInputStyles } from '@/src/theme/commonStyles';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../../theme';

interface Props {
  visible: boolean;
  initialValues?: { name: string; description: string | null };
  title?: string;
  confirmLabel?: string;
  onCancel: () => void;
  onConfirm: (name: string, description: string | null) => void;
}

const BoardCreateModal: React.FC<Props> = ({
  visible,
  initialValues,
  title,
  confirmLabel,
  onCancel,
  onConfirm,
}) => {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const commonInputStyles = getCommonInputStyles(colors);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  useEffect(() => {
    if (visible) {
      setName(initialValues?.name ?? '');
      setDescription(initialValues?.description ?? '');
    }
  }, [initialValues, visible]);

  const styles = StyleSheet.create({
    sheet: {
      backgroundColor: colors.surface,
      borderRadius: 10,
      padding: 20,
    },
    title: {
      fontSize: 20,
      fontWeight: 'bold',
      color: colors.text,
      marginBottom: 16,
      textAlign: 'center',
    },
    label: { fontSize: 16, fontWeight: 'bold', color: colors.text, marginBottom: 5 },
    field: { marginBottom: 12 },
    buttons: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: 8,
    },
    buttonWrapper: { width: '47%' },
  });

  return (
    <ResponsiveModal
      visible={visible}
      onClose={onCancel}
      contentStyle={styles.sheet}
      maxHeight="86%"
    >
      <Text style={styles.title}>{title ?? t('board_create_title')}</Text>
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
          placeholder={t('board_description_placeholder')}
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

export default BoardCreateModal;
