import React from 'react';
import { Text, type TextProps } from 'react-native';
import { useTheme } from '../../../../theme';
import { typography } from '../../../../theme/tokens';

/** The colour a text carries, by what it says rather than by hex: the palette decides the value. */
export type TextTone = 'default' | 'secondary' | 'primary' | 'error' | 'onPrimary';

interface ThemedTextProps extends TextProps {
  /** `default` is the body colour; `secondary` the quieter one for hints and captions. */
  tone?: TextTone;
  /** A size and weight from the type scale (`theme/tokens`); without one the text keeps the platform default. */
  variant?: keyof typeof typography;
}

/**
 * A `Text` in a colour of the palette, with an optional step of the type scale. It replaces the
 * `<Text style={{ color: colors.textSecondary }}>` a component wrote only to read the theme; a style
 * passed in still wins, so a margin or a different weight rides along.
 */
const ThemedText: React.FC<ThemedTextProps> = ({ tone = 'default', variant, style, ...rest }) => {
  const { colors } = useTheme();
  const color = {
    default: colors.text,
    secondary: colors.textSecondary,
    primary: colors.primary,
    error: colors.error,
    onPrimary: colors.onPrimary,
  }[tone];

  return <Text {...rest} style={[variant && typography[variant], { color }, style]} />;
};

export default ThemedText;
