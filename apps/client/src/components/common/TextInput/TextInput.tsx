import React from 'react';
import { Platform, TextInput as RNTextInput, StyleSheet, TextInputProps } from 'react-native';
import { useTheme } from '../../../theme';
import { getCommonInputStyles } from '../../../theme/commonStyles';

type CustomTextInputProps = TextInputProps;

const TextInput: React.FC<CustomTextInputProps> = ({ style, ...rest }) => {
  const { colors } = useTheme();
  const commonInputStyles = getCommonInputStyles(colors);

  const styles = StyleSheet.create({
    input: {
      width: '80%',
      height: 50,
      borderColor: colors.primary,
      borderWidth: 1,
      borderRadius: 5,
      paddingHorizontal: 10,
      marginBottom: 20,
      color: colors.text,
      backgroundColor: colors.surface,
      fontSize: 16,
      ...(Platform.OS === 'web' ? { outlineWidth: 0, outlineColor: 'transparent' } : {}),
    },
  });

  // A multiline field asks to grow taller than the single-line default via `minHeight` in its
  // own `style` prop (e.g. `{ minHeight: 100, textAlignVertical: 'top' }`) - but every fixed
  // `height` already in the chain (this component's own default above, and the shared
  // `commonInputStyles.input` most callers redundantly re-include alongside their `minHeight`)
  // sits in the very same flattened style object as that `minHeight`. Yoga resolves an explicit
  // `height` before `minHeight` regardless of which one appears later in the array, so every
  // multiline field using this component was silently pinned to one line no matter how tall
  // its `minHeight` asked for. Clearing `height` last - only when a taller `minHeight` was
  // actually requested - is what makes that request actually take effect.
  const requestedMinHeight = StyleSheet.flatten(style)?.minHeight;
  const heightOverride = requestedMinHeight ? { height: undefined } : null;

  return (
    <RNTextInput
      style={[commonInputStyles.input, styles.input, style, heightOverride]}
      placeholderTextColor={colors.textSecondary}
      {...rest}
    />
  );
};

export default TextInput;
