import { useFocusEffect } from '@react-navigation/native';
import { useCallback } from 'react';
import { Platform } from 'react-native';

/**
 * Sets `document.title` directly - a no-op on native (Android/iOS), where `document` doesn't
 * exist and there's no OS-level equivalent to drive without native code.
 *
 * Detail screens call this directly, alongside their existing `navigation.getParent()?.setOptions`
 * call, rather than relying solely on `DocumentTitleSync`'s navigation-options listener: their
 * header title resolves in two steps (an immediate "Loading..." followed by the real name once
 * an async fetch completes), and that second, in-place update - not accompanied by an actual
 * navigation transition - isn't reliably picked up by that listener. Calling this directly, right
 * after `setOptions`, guarantees `document.title` matches what's actually shown.
 */
export function setDocumentTitle(title: string) {
  if (Platform.OS !== 'web') return;
  document.title = title ? `Keres: ${title}` : 'Keres';
}

/**
 * Keeps the Electron/browser title in lockstep with a screen while it is focused.
 *
 * React Navigation leaves screens mounted when another route is pushed or when a nested
 * drawer is selected. A plain mount effect therefore preserves the previous screen's title
 * when returning. This hook deliberately follows the navigation focus lifecycle instead.
 */
export function useDocumentTitle(title: string) {
  useFocusEffect(
    useCallback(() => {
      setDocumentTitle(title);
    }, [title]),
  );
}
