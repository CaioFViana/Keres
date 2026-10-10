import { SingleSelectPill } from '@/src/components/common';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity } from 'react-native';
import { type ThemeColors, useTheme } from '../../../theme';
import { useThemedStyles } from '../../../theme/useThemedStyles';

interface WelcomeLanguagePickerProps {
  options: { label: string; value: string }[];
  value: string | null;
  onValueChange: (value: string | null) => void;
  placeholder: string;
}

/**
 * The language choice at the top of the welcome: a quiet chip - a soft surface, no frame - instead
 * of the form field the rest of the app uses. It is not a field here, it is a setting you might
 * glance at once, and the field's accent border made it the loudest thing on a screen that is
 * trying to be calm. The list it opens is the app's own.
 */
const WelcomeLanguagePicker: React.FC<WelcomeLanguagePickerProps> = ({
  options,
  value,
  onValueChange,
  placeholder,
}) => {
  const { colors } = useTheme();
  const label = options.find((option) => option.value === value)?.label ?? placeholder;
  const styles = useThemedStyles(createStyles);

  return (
    <SingleSelectPill
      options={options}
      value={value}
      onValueChange={onValueChange}
      placeholder={placeholder}
      trigger={(open) => (
        <TouchableOpacity
          onPress={open}
          style={styles.chip}
          accessibilityRole="button"
          accessibilityLabel={placeholder}
          testID="welcome-language-trigger"
        >
          <Ionicons name="language-outline" size={18} color={colors.textSecondary} />
          <Text style={styles.label} numberOfLines={1}>
            {label}
          </Text>
          <Ionicons name="chevron-down" size={16} color={colors.textSecondary} />
        </TouchableOpacity>
      )}
    />
  );
};

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-start',
      gap: 8,
      paddingVertical: 9,
      paddingHorizontal: 14,
      borderRadius: 999,
      backgroundColor: colors.surface,
    },
    label: { fontSize: 15, fontWeight: '600', color: colors.text },
  });

export default WelcomeLanguagePicker;
