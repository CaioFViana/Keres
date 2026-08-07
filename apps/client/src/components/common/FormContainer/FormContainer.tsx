import React from 'react';
import { Keyboard, Platform, ScrollView, StyleProp, StyleSheet, ViewStyle } from 'react-native'; // Re-import Keyboard and add StyleProp, ViewStyle
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
      // Web has no on-screen keyboard to dismiss, and react-native-web's responder-release
      // polyfill doesn't replicate native's "only if the touch didn't land on a nested
      // responder" negotiation - it fires for a release on the ScrollView's own child inputs
      // too, blurring a field the instant it's clicked (see the same fix on each *FormScreen's
      // TouchableWithoutFeedback, onPress={Keyboard.dismiss}).
      onResponderRelease={Platform.OS === 'web' ? undefined : Keyboard.dismiss}
    >
      {children}
    </ScrollView>
  );
};

export default FormContainer;
