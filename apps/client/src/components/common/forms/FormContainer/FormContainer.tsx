import React from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { StyleSheet } from 'react-native';
import KeyboardAwareScreen from '@/src/components/layout/KeyboardAwareScreen/KeyboardAwareScreen';
import { useTheme } from '../../../../theme';

interface FormContainerProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>; // Add style prop
}

const FormContainer: React.FC<FormContainerProps> = ({ children, style }) => {
  const { colors } = useTheme();

  const styles = StyleSheet.create({
    innerContainer: {
      flexGrow: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: colors.background,
      width: '100%',
      maxWidth: 840,
      alignSelf: 'center',
      padding: 20,
    },
  });

  return (
    <KeyboardAwareScreen
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={[styles.innerContainer, style]}
    >
      {children}
    </KeyboardAwareScreen>
  );
};

export default FormContainer;
