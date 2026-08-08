import React from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleProp,
  StyleSheet,
  TouchableWithoutFeedback,
  ViewStyle,
} from 'react-native';
import { useFormScrollBottomPadding } from '../../../hooks/useFormScrollBottomPadding';

interface KeyboardAwareScreenProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  contentContainerStyle?: StyleProp<ViewStyle>;
  keyboardVerticalOffset?: number;
}

/**
 * Common form shell. Android needs an explicit resize/height behavior; leaving
 * it undefined makes the keyboard cover the lower part of the form.
 */
const KeyboardAwareScreen: React.FC<KeyboardAwareScreenProps> = ({
  children,
  style,
  contentContainerStyle,
  keyboardVerticalOffset = 0,
}) => {
  const bottomPadding = useFormScrollBottomPadding();
  const behavior = Platform.OS === 'ios'
    ? 'padding'
    : Platform.OS === 'android'
      ? 'height'
      : undefined;

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={behavior}
      keyboardVerticalOffset={Platform.OS === 'ios' ? keyboardVerticalOffset : 0}
    >
      <TouchableWithoutFeedback
        onPress={Platform.OS === 'web' ? undefined : Keyboard.dismiss}
      >
        <ScrollView
          style={[styles.flex, style]}
          contentContainerStyle={[{ paddingBottom: bottomPadding }, contentContainerStyle]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
        >
          {children}
        </ScrollView>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
});

export default KeyboardAwareScreen;

