import React from 'react';
import { TextInput as RNTextInput, StyleSheet, TextInputProps } from 'react-native';
import { useTheme } from '../../../theme';

interface CustomTextInputProps extends TextInputProps {}

const TextInput: React.FC<CustomTextInputProps> = ({ style, ...rest }) => {
  const { colors } = useTheme();

  const styles = StyleSheet.create({
    input: {
      width: '80%',
      height: 50,
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: 5,
      paddingHorizontal: 10,
      marginBottom: 20,
      color: colors.text,
      backgroundColor: colors.surface,
      fontSize: 16
    },
  });

  return (
    <RNTextInput
      style={[styles.input, style]}
      placeholderTextColor={colors.textSecondary}
      {...rest}
    />
  );
};

export default TextInput;
