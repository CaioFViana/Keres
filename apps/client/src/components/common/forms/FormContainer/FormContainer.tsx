import React from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { StyleSheet } from 'react-native';
import KeyboardAwareScreen from '@/src/components/layout/KeyboardAwareScreen/KeyboardAwareScreen';
import type { ThemeColors } from '../../../../theme';
import { useThemedStyles } from '../../../../theme/useThemedStyles';

interface FormContainerProps {
  children: React.ReactNode;
  /** Applied to the scroll view chrome (`flex: 1`, background), not the scroll content. */
  style?: StyleProp<ViewStyle>;
}

/**
 * Centred auth/onboarding shell. `style` must not land on `contentContainerStyle`: a `flex: 1`
 * there (e.g. `common.container`) pins content to the viewport and blocks scrolling.
 */
const FormContainer: React.FC<FormContainerProps> = ({ children, style }) => {
  const styles = useThemedStyles(createStyles);

  return (
    <KeyboardAwareScreen
      style={[styles.screen, style]}
      contentContainerStyle={styles.innerContainer}
    >
      {children}
    </KeyboardAwareScreen>
  );
};

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: colors.background,
    },
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

export default FormContainer;
