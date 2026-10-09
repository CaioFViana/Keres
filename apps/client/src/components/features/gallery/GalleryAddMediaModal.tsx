import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import ModalHeader from '@/src/components/layout/ModalHeader/ModalHeader';
import ResponsiveModal from '@/src/components/layout/ResponsiveModal/ResponsiveModal';
import { type ThemeColors, useTheme } from '@/src/theme';
import { useThemedStyles } from '@/src/theme/useThemedStyles';

export type EntityMediaAddKind = 'playable' | 'document' | 'link' | 'existing';

interface Props {
  visible: boolean;
  onClose: () => void;
  onPick: (kind: EntityMediaAddKind) => void;
}

const addKinds: {
  kind: EntityMediaAddKind;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
}[] = [
  { kind: 'playable', icon: 'images-outline', label: 'gallery_add_playable' },
  { kind: 'document', icon: 'document-text-outline', label: 'gallery_add_document' },
  { kind: 'link', icon: 'link-outline', label: 'gallery_add_link' },
  { kind: 'existing', icon: 'albums-outline', label: 'gallery_attach_existing' },
];

/** Icon-only chooser for the ways a detail screen can attach media to its entity. */
const GalleryAddMediaModal: React.FC<Props> = ({ visible, onClose, onPick }) => {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const styles = useThemedStyles(createStyles);

  return (
    <ResponsiveModal
      visible={visible}
      onClose={onClose}
      tone="raised"
      inset="roomy"
      maxHeight="86%"
    >
      <ModalHeader title={t('gallery_add_title')} onClose={onClose} closeLabel={t('cancel')} />
      <Text style={styles.message}>{t('gallery_add_message')}</Text>
      <View style={styles.options}>
        {addKinds.map((option) => (
          <TouchableOpacity
            key={option.kind}
            accessibilityLabel={t(option.label)}
            accessibilityRole="button"
            onPress={() => onPick(option.kind)}
            style={styles.option}
          >
            <Ionicons name={option.icon} size={30} color={colors.onPrimary} />
          </TouchableOpacity>
        ))}
      </View>
    </ResponsiveModal>
  );
};

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    message: { color: colors.textSecondary, lineHeight: 19 },
    options: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 14,
      justifyContent: 'center',
      marginTop: 22,
    },
    option: {
      alignItems: 'center',
      backgroundColor: colors.primary,
      borderRadius: 12,
      height: 60,
      justifyContent: 'center',
      width: 60,
    },
  });

export default GalleryAddMediaModal;
