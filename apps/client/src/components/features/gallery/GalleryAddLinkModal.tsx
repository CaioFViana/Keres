import FormActions from '@/src/components/common/controls/FormActions/FormActions';
import Button from '@/src/components/common/controls/Button/Button';
import TextInput from '@/src/components/common/inputs/TextInput/TextInput';
import ResponsiveModal from '@/src/components/layout/ResponsiveModal/ResponsiveModal';
import { getCommonInputStyles } from '@/src/theme/commonStyles';
import { normalizeGalleryLink } from '@keres/shared';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../../theme';

interface Props {
  visible: boolean;
  onCancel: () => void;
  onConfirm: (url: string, title: string | null) => void;
}

const GalleryAddLinkModal: React.FC<Props> = ({ visible, onCancel, onConfirm }) => {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const commonInputStyles = getCommonInputStyles(colors);
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');

  useEffect(() => {
    if (visible) {
      setUrl('');
      setTitle('');
    }
  }, [visible]);

  const normalized = normalizeGalleryLink(url);
  const styles = StyleSheet.create({
    sheet: {
      backgroundColor: colors.surface,
      borderRadius: 10,
      padding: 20,
      overflow: 'visible',
    },
    title: {
      fontSize: 20,
      fontWeight: 'bold',
      color: colors.text,
      marginBottom: 8,
      textAlign: 'center',
    },
    hint: { fontSize: 13, color: colors.textSecondary, marginBottom: 16, lineHeight: 18 },
    label: { fontSize: 16, fontWeight: 'bold', color: colors.text, marginBottom: 5 },
    field: { marginBottom: 12, paddingHorizontal: 2, paddingVertical: 2 },
    buttons: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: 8,
      paddingHorizontal: '3%',
    },
  });

  return (
    <ResponsiveModal
      visible={visible}
      onClose={onCancel}
      contentStyle={styles.sheet}
      maxHeight="86%"
    >
      <Text style={styles.title}>{t('gallery_add_link_title')}</Text>
      <Text style={styles.hint}>{t('gallery_add_link_hint')}</Text>
      <View style={styles.field}>
        <Text style={styles.label}>{t('gallery_link_url')}</Text>
        <TextInput
          value={url}
          onChangeText={setUrl}
          placeholder="https://"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          style={commonInputStyles.input}
        />
      </View>
      <View style={styles.field}>
        <Text style={styles.label}>{t('title')}</Text>
        <TextInput
          value={title}
          onChangeText={setTitle}
          placeholder={t('title_optional')}
          style={commonInputStyles.input}
        />
      </View>
      <FormActions>
        <Button onPress={onCancel}>{t('cancel')}</Button>
        <Button
          disabled={!normalized}
          onPress={() => normalized && onConfirm(normalized, title.trim() || null)}
        >
          {t('save')}
        </Button>
      </FormActions>
    </ResponsiveModal>
  );
};

export default GalleryAddLinkModal;
