import { requireNativeModule } from 'expo';
import { Platform } from 'react-native';

type Style = 'light' | 'dark';

/**
 * Tells Android's navigation bar, again, which way its buttons should be tinted: `dark` for dark buttons
 * on a light bar, `light` for the opposite - the vocabulary of `expo-navigation-bar`.
 *
 * `<NavigationBar>` only talks to the native side when its own idea of the style changes, and a `Modal`
 * is a window of its own that React Native restyles from the *system*'s scheme every time it updates
 * (`ReactModalHostView.updateProperties`). The JS side never learns of that, so a modal opened over a
 * dark app on a light phone kept light buttons-for-a-light-bar until something else changed the style.
 * Asking the native module straight skips that bookkeeping, and it restyles every window the app has
 * open, the modal's included.
 *
 * Android only, and best effort: an app without the native module keeps the bar as it was. The native
 * module is looked up on the call, never at import, since it does not exist off Android.
 */
export function applyNavigationBarStyle(style: Style): void {
  if (Platform.OS !== 'android') return;
  try {
    void Promise.resolve(requireNativeModule('ExpoNavigationBar').setStyle(style)).catch(() => {});
  } catch {
    // Cosmetic only.
  }
}
