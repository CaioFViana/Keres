import React from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useTheme } from '../../../../theme';
import ModalHeader from '@/src/components/layout/ModalHeader/ModalHeader';
import ResponsiveModal from '@/src/components/layout/ResponsiveModal/ResponsiveModal';

interface ConflictSheetFrameProps {
  visible: boolean;
  title: string;
  subtitle: string;
  onClose: () => void;
  children: React.ReactNode;
}

/** Bottom-sheet chrome shared by the conflict sheets: grab handle, title, close button, scrollable body. */
const ConflictSheetFrame: React.FC<ConflictSheetFrameProps> = ({
  visible,
  title,
  subtitle,
  onClose,
  children,
}) => {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = StyleSheet.create({
    sheet: { maxHeight: '85%' },
    handle: {
      alignSelf: 'center',
      width: 42,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.border,
      marginBottom: 14,
    },
  });

  return (
    <ResponsiveModal
      visible={visible}
      onClose={onClose}
      placement="adaptive"
      tone="raised"
      inset="sheet"
      contentStyle={styles.sheet}
      maxHeight="85%"
    >
      <View style={styles.handle} />
      <ModalHeader
        title={title}
        subtitle={subtitle}
        onClose={onClose}
        closeLabel={t('conflict_close_details')}
      />

      <ScrollView>{children}</ScrollView>
    </ResponsiveModal>
  );
};

export default ConflictSheetFrame;
