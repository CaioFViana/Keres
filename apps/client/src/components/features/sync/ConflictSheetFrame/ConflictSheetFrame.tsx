import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTheme } from '../../../../theme';
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
    header: { flexDirection: 'row', alignItems: 'center' },
    headerText: { flex: 1, marginRight: 12 },
    title: { fontSize: 18, fontWeight: 'bold', color: colors.text },
    subtitle: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
    closeButton: { padding: 4 },
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
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
        </View>
        <TouchableOpacity
          onPress={onClose}
          style={styles.closeButton}
          accessibilityRole="button"
          accessibilityLabel={t('conflict_close_details')}
        >
          <Ionicons name="close" size={24} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      <ScrollView>{children}</ScrollView>
    </ResponsiveModal>
  );
};

export default ConflictSheetFrame;
