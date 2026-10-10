import { Ionicons } from '@expo/vector-icons';
import { getOnColorForFill } from '@keres/shared';
import React, { useMemo } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTheme } from '../../../../theme';

/**
 * `primary` is the filled call to action; `secondary` and `danger` are outlined, for what is offered
 * next to it - so a row of choices does not read as a row of equally loud buttons. `destructive` is
 * filled in the error colour: the one that deletes what the form is about, beside its save.
 */
export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'destructive';

interface ButtonProps {
  variant?: ButtonVariant;
  /** Drawn before a text label, in the label's color: the icon says it at a glance, the word says it exactly. */
  icon?: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
  testID?: string;
  accessibilityLabel?: string;
  accessibilityHint?: string;
}

const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  icon,
  onPress,
  children,
  style,
  disabled,
  testID,
  accessibilityLabel,
  accessibilityHint,
}) => {
  const { colors } = useTheme();

  const styles = useMemo(() => {
    const outline = variant === 'secondary' ? colors.primary : colors.error;
    const outlined = variant === 'secondary' || variant === 'danger';
    const base = {
      backgroundColor: outlined
        ? 'transparent'
        : variant === 'destructive'
          ? colors.error
          : colors.primary,
      ...(outlined ? { borderWidth: 1.5, borderColor: outline } : {}),
      paddingVertical: 12,
      paddingHorizontal: 20,
      borderRadius: 8,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
      ...(Platform.OS === 'web' ? { outlineWidth: 0, outlineColor: 'transparent' } : {}),
    };
    const flattened = StyleSheet.flatten([base, style]);
    const background =
      typeof flattened?.backgroundColor === 'string' ? flattened.backgroundColor : colors.primary;

    const textColor = outlined ? outline : getOnColorForFill(colors, background);

    return {
      textColor,
      ...StyleSheet.create({
        button: base,
        disabledButton: {
          opacity: 0.6,
        },
        buttonText: {
          color: textColor,
          fontSize: 16,
          fontWeight: 'bold',
        },
        shrink: { flexShrink: 1 },
        withIcon: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 8 },
      }),
    };
  }, [colors, style, variant]);

  return (
    <TouchableOpacity
      style={[styles.button, disabled && styles.disabledButton, style]}
      onPress={onPress}
      disabled={disabled}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
    >
      {typeof children !== 'string' ? (
        children
      ) : icon ? (
        <View style={styles.withIcon}>
          <Ionicons name={icon} size={18} color={styles.textColor} />
          <Text style={[styles.buttonText, styles.shrink]}>{children}</Text>
        </View>
      ) : (
        <Text style={styles.buttonText}>{children}</Text>
      )}
    </TouchableOpacity>
  );
};

export default Button;
