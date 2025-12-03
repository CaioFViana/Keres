import React from 'react';
import { Keyboard, ScrollView, StyleProp, StyleSheet, ViewStyle } from 'react-native'; // Re-import Keyboard and add StyleProp, ViewStyle
import { useTheme } from '../../../theme';

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
      padding: 20,
    },
    scrollView: {
      flex: 1,
    },
  });

  return (
    <ScrollView
      style={styles.scrollView}
      contentContainerStyle={[styles.innerContainer, style]}
      keyboardShouldPersistTaps="handled"
      onResponderRelease={Keyboard.dismiss}
    >
      {children}
    </ScrollView>
  );
};

export default FormContainer;
