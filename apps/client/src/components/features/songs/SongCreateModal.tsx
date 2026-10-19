import { MAX_SONG_TITLE_LENGTH } from '@keres/shared';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import Button from '@/src/components/common/controls/Button/Button';
import TextInput from '@/src/components/common/inputs/TextInput/TextInput';
import ResponsiveModal from '@/src/components/layout/ResponsiveModal/ResponsiveModal';
import type { ThemeColors } from '@/src/theme';
import { useThemedStyles } from '@/src/theme/useThemedStyles';
import { space, typography } from '@/src/theme/tokens';
import ModalHeader from '@/src/components/layout/ModalHeader/ModalHeader';

interface SongCreateModalProps {
  visible: boolean;
  onCancel: () => void;
  onConfirm: (title: string) => void;
}

/** A new song starts from its title alone: everything else is written in the editor it opens. */
const SongCreateModal: React.FC<SongCreateModalProps> = ({ visible, onCancel, onConfirm }) => {
  const { t } = useTranslation();
  const [title, setTitle] = useState('');
  // The field starts empty each time the modal opens; typing is left alone while it stays open.
  const [prevVisible, setPrevVisible] = useState<boolean | null>(null);
  if (visible !== prevVisible) {
    setPrevVisible(visible);
    if (visible) setTitle('');
  }
  const styles = useThemedStyles(createStyles);
  return (
    <ResponsiveModal
      visible={visible}
      onClose={onCancel}
      placement="adaptive"
      tone="raised"
      inset="sheet"
    >
      <ModalHeader title={t('song_create_title')} />
      <Text style={styles.label}>{t('song_title')}</Text>
      <TextInput
        testID="song-create-title"
        accessibilityLabel={t('song_title')}
        value={title}
        onChangeText={setTitle}
        placeholder={t('song_title_placeholder')}
        maxLength={MAX_SONG_TITLE_LENGTH}
      />
      <View style={styles.actions}>
        <Button onPress={onCancel}>{t('cancel')}</Button>
        <Button onPress={() => onConfirm(title.trim())} disabled={!title.trim()}>
          {t('add')}
        </Button>
      </View>
    </ResponsiveModal>
  );
};

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    title: { ...typography.title, color: colors.text, marginBottom: space.lg },
    label: { ...typography.sectionTitle, color: colors.text, marginBottom: 5 },
    actions: { flexDirection: 'row', gap: 12, justifyContent: 'flex-end', marginTop: 18 },
  });

export default SongCreateModal;
