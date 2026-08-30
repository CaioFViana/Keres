import { KeyboardAwareContext } from '@/src/components/layout/KeyboardAwareScreen/KeyboardAwareScreen';
import React, { useContext, useState } from 'react';
import type { TextInputProps } from 'react-native';
import { Platform, TextInput as RNTextInput, StyleSheet } from 'react-native';
import { useTheme } from '../../../../theme';
import { getCommonInputStyles } from '../../../../theme/commonStyles';

type CustomTextInputProps = TextInputProps & {
  /** The parent composite control already draws the focus boundary. */
  suppressInteractionBorder?: boolean;
};

const TextInput = React.forwardRef<RNTextInput, CustomTextInputProps>(
  (
    {
      style,
      onBlur,
      onFocus,
      onPointerEnter,
      onPointerLeave,
      multiline,
      suppressInteractionBorder = false,
      ...rest
    },
    ref,
  ) => {
    const { colors } = useTheme();
    const requestFocusScroll = useContext(KeyboardAwareContext);
    const [isFocused, setIsFocused] = useState(false);
    const [isHovered, setIsHovered] = useState(false);
    const commonInputStyles = getCommonInputStyles(colors);

    const styles = StyleSheet.create({
      multilineInput: {
        paddingTop: 10,
        paddingBottom: 10,
        textAlignVertical: 'top',
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
    const interactionStyle =
      !suppressInteractionBorder && (isFocused || (Platform.OS === 'web' && isHovered))
        ? {
            borderColor: colors.primary,
            borderStyle: 'solid' as const,
            borderWidth: 1,
          }
        : null;

    return (
      <RNTextInput
        ref={ref}
        style={[
          commonInputStyles.input,
          multiline && styles.multilineInput,
          style,
          interactionStyle,
          heightOverride,
        ]}
        placeholderTextColor={colors.textSecondary}
        onFocus={(event) => {
          setIsFocused(true);
          onFocus?.(event);
          requestFocusScroll?.();
        }}
        onBlur={(event) => {
          setIsFocused(false);
          onBlur?.(event);
        }}
        onPointerEnter={(event) => {
          setIsHovered(true);
          onPointerEnter?.(event);
        }}
        onPointerLeave={(event) => {
          setIsHovered(false);
          onPointerLeave?.(event);
        }}
        multiline={multiline}
        {...rest}
      />
    );
  },
);

TextInput.displayName = 'TextInput';

export default TextInput;
