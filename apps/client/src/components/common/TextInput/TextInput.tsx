import React from 'react';
import { TextInput as RNTextInput, StyleSheet, TextInputProps } from 'react-native';
import { useTheme } from '../../../theme';
import { getCommonInputStyles } from '../../../theme/commonStyles';

interface CustomTextInputProps extends TextInputProps {}

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
      fontSize: 16
    },
  });

  return (
    <RNTextInput
      style={[commonInputStyles.input, styles.input, style]}
      placeholderTextColor={colors.textSecondary}
      {...rest}
    />
  );
};

export default TextInput;
