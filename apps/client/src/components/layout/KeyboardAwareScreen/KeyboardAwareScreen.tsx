import React from 'react';
import {
  Dimensions,
  findNodeHandle,
  Keyboard,
  KeyboardEvent,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleProp,
  StyleSheet,
  TextInput as RNTextInput,
  UIManager,
  ViewStyle,
} from 'react-native';
import { useFormScrollBottomPadding } from '../../../hooks/useFormScrollBottomPadding';

export const KeyboardAwareContext = React.createContext<(() => void) | null>(null);

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
  keyboardVerticalOffset = 64,
}) => {
  const bottomPadding = useFormScrollBottomPadding();
  const scrollRef = React.useRef<ScrollView>(null);
  const scrollOffset = React.useRef(0);
  const keyboardTop = React.useRef<number | null>(null);
  const focusScrollTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const behavior = Platform.OS === 'ios'
    ? 'padding'
    : Platform.OS === 'android'
      ? 'height'
      : undefined;

  const scrollToFocusedInput = React.useCallback(() => {
    if (Platform.OS === 'web') return;

    if (focusScrollTimer.current) {
      clearTimeout(focusScrollTimer.current);
    }

    focusScrollTimer.current = setTimeout(() => {
      const focusedInput = RNTextInput.State.currentlyFocusedInput?.();
      const node = focusedInput ? findNodeHandle(focusedInput as any) : null;
      if (!node) return;

      UIManager.measureInWindow(node, (_x, y, _width, height) => {
        const visibleBottom = (keyboardTop.current ?? Dimensions.get('window').height) - bottomPadding;
        const overlap = y + height + 24 - visibleBottom;

        if (overlap > 0) {
          scrollRef.current?.scrollTo({
            y: Math.max(0, scrollOffset.current + overlap),
            animated: true,
          });
        }
      });
    }, Platform.OS === 'android' ? 120 : 60);
  }, [bottomPadding]);

  React.useEffect(() => {
    const handleKeyboardShow = (event: KeyboardEvent) => {
      keyboardTop.current = event.endCoordinates?.screenY ?? null;
      scrollToFocusedInput();
      // Android may finish the resize after keyboardDidShow. A second pass is
      // needed because the input's window coordinates can change during resize.
      focusScrollTimer.current = setTimeout(scrollToFocusedInput, 260);
    };
    const handleKeyboardHide = () => {
      keyboardTop.current = null;
    };

    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const showSubscription = Keyboard.addListener(showEvent, handleKeyboardShow);
    const hideSubscription = Keyboard.addListener('keyboardDidHide', handleKeyboardHide);

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
      if (focusScrollTimer.current) clearTimeout(focusScrollTimer.current);
    };
  }, [scrollToFocusedInput]);

  return (
    <KeyboardAwareContext.Provider value={scrollToFocusedInput}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={behavior}
        keyboardVerticalOffset={Platform.OS === 'ios' ? keyboardVerticalOffset : 0}
      >
        <ScrollView
          ref={scrollRef}
          style={[styles.flex, style]}
          contentContainerStyle={[{ paddingBottom: bottomPadding }, contentContainerStyle]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
          onScroll={(event) => {
            scrollOffset.current = event.nativeEvent.contentOffset.y;
          }}
          scrollEventThrottle={16}
          onTouchEnd={scrollToFocusedInput}
        >
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </KeyboardAwareContext.Provider>
  );
};

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
});

export default KeyboardAwareScreen;
