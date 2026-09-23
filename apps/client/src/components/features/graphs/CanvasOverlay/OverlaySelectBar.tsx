import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import Button from '@/src/components/common/controls/Button/Button';
import { useTheme } from '../../../../theme';

interface OverlaySelectBarProps {
  onDone: () => void;
}

/**
 * Replaces the canvas tools while the select tool is armed: the gesture hint plus
 * Done. Selecting an object keeps the mode (handles appear instead of a modal), so
 * Done is the explicit way out.
 */
const OverlaySelectBar: React.FC<OverlaySelectBarProps> = ({ onDone }) => {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = StyleSheet.create({
    bar: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
      backgroundColor: colors.surface,
    },
    hint: { color: colors.textSecondary, marginBottom: 8 },
  });
  return (
    <View style={styles.bar}>
      <Text style={styles.hint}>{t('overlay_select_hint')}</Text>
      <Button onPress={onDone} style={{ height: 50 }}>
        {t('overlay_select_done')}
      </Button>
    </View>
  );
};

export default OverlaySelectBar;
