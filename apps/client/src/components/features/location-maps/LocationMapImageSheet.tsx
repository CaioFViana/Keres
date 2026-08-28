import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Button from '@/src/components/common/controls/Button/Button';
import ResponsiveModal from '@/src/components/layout/ResponsiveModal/ResponsiveModal';
import { useTheme } from '../../../theme';

interface Props {
  visible: boolean;
  onClose: () => void;
  onResize: (factor: number) => void;
  onRemove: () => void;
}

/**
 * Sheet for the selected image base: +/− resize buttons (keeping the aspect ratio) and removal.
 */
const LocationMapImageSheet: React.FC<Props> = ({ visible, onClose, onResize, onRemove }) => {
  const { colors } = useTheme();
  const { t } = useTranslation();

  const styles = StyleSheet.create({
    sheet: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: 16,
      borderTopRightRadius: 16,
      padding: 20,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 24,
    },
    sizeButton: {
      width: 56,
      height: 56,
      borderRadius: 28,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primaryContainer,
      borderWidth: 1,
      borderColor: colors.border,
    },
    hint: {
      color: colors.textSecondary,
      fontSize: 13,
      textAlign: 'center',
      marginVertical: 12,
    },
    remove: { marginTop: 16 },
  });

  return (
    <ResponsiveModal visible={visible} onClose={onClose} placement="adaptive">
      <View style={styles.sheet}>
        <View style={styles.row}>
          <TouchableOpacity
            style={styles.sizeButton}
            onPress={() => onResize(0.9)}
            accessibilityLabel={t('location_map_shrink_image')}
          >
            <Ionicons name="remove" size={28} color={colors.text} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.sizeButton}
            onPress={() => onResize(1.1)}
            accessibilityLabel={t('location_map_grow_image')}
          >
            <Ionicons name="add" size={28} color={colors.text} />
          </TouchableOpacity>
        </View>
        <Text style={styles.hint}>{t('location_map_image_size_hint')}</Text>
        <Button onPress={onRemove} style={[styles.remove, { backgroundColor: colors.error }]}>
          {t('location_map_remove_image')}
        </Button>
      </View>
    </ResponsiveModal>
  );
};

export default LocationMapImageSheet;