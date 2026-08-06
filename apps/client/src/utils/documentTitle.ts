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
