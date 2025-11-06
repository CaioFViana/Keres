import React from 'react';
import { Keyboard, ScrollView, StyleSheet, View } from 'react-native'; // Re-import Keyboard
import { useTheme } from '../../../theme';

interface FormContainerProps {
  children: React.ReactNode;
}

const FormContainer: React.FC<FormContainerProps> = ({ children }) => {
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
      contentContainerStyle={styles.innerContainer}
      keyboardShouldPersistTaps="handled"
      onResponderRelease={Keyboard.dismiss} // Add this prop
    >
      {children}
    </ScrollView>
  );
};

export default FormContainer;
