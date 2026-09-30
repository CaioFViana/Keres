import React from 'react';
import type { KeyboardEvent, StyleProp, ViewStyle } from 'react-native';
import {
  Dimensions,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput as RNTextInput,
} from 'react-native';
import { useFormScrollBottomPadding } from '../../../hooks/useFormScrollBottomPadding';

/** Exposes `scrollToFocusedInput` to descendants so custom inputs can request a scroll-into-view pass. */
export const KeyboardAwareContext = React.createContext<(() => void) | null>(null);

interface KeyboardAwareScreenProps {
  children: React.ReactNode;
  /**
   * Pinned below the scroll view, inside the keyboard-avoiding container:
   * composer bars and action rows stay visible (and above the keyboard)
   * instead of scrolling away with the content.
   */
  footer?: React.ReactNode;
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
  footer,
  style,
  contentContainerStyle,
  keyboardVerticalOffset = 64,
}) => {
  const bottomPadding = useFormScrollBottomPadding();
  const requestedBottomPadding = StyleSheet.flatten(contentContainerStyle)?.paddingBottom;
  const scrollRef = React.useRef<ScrollView>(null);
  const scrollOffset = React.useRef(0);
  const keyboardTop = React.useRef<number | null>(null);
  const focusScrollTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const mounted = React.useRef(true);
  const behavior =
    Platform.OS === 'ios' ? 'padding' : Platform.OS === 'android' ? 'height' : undefined;

  const scrollToFocusedInput = React.useCallback(() => {
    if (Platform.OS === 'web') return;

    if (focusScrollTimer.current) {
      clearTimeout(focusScrollTimer.current);
    }

    focusScrollTimer.current = setTimeout(
      () => {
        // The timer outlives the screen by up to a quarter of a second, and the focused input can be
        // gone by then (the screen closed, the field swapped): measuring a view that no longer exists
        // makes React Native warn "measure cannot find view with tag".
        if (!mounted.current) return;
        const focusedInput = RNTextInput.State.currentlyFocusedInput?.();
        // The input's own method, not `UIManager` by tag: it stays quiet when the native view is gone.
        if (!focusedInput || typeof focusedInput.measureInWindow !== 'function') return;

        focusedInput.measureInWindow((_x, y, _width, height) => {
          const visibleBottom =
            (keyboardTop.current ?? Dimensions.get('window').height) - bottomPadding;
          const overlap = y + height + 24 - visibleBottom;

          if (overlap > 0) {
            scrollRef.current?.scrollTo({
              y: Math.max(0, scrollOffset.current + overlap),
              animated: true,
            });
          }
        });
      },
      Platform.OS === 'android' ? 120 : 60,
    );
  }, [bottomPadding]);

  React.useEffect(() => {
    mounted.current = true;
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
      mounted.current = false;
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
          contentContainerStyle={[
            contentContainerStyle,
            {
              paddingBottom: Math.max(
                bottomPadding,
                typeof requestedBottomPadding === 'number' ? requestedBottomPadding : 0,
              ),
            },
          ]}
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
        {footer}
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
