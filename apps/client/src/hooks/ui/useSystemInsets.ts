import { useContext } from 'react';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';

const NONE = { top: 0, right: 0, bottom: 0, left: 0 };

/**
 * The system bars' insets, for surfaces that live in a window of their own (a `Modal`), where the
 * root's padding does not reach: on Android the status and navigation bars draw over them.
 * Without a provider (web, tests) there is nothing to avoid, so the insets are all zero - unlike
 * `useSafeAreaInsets`, which throws there.
 */
export function useSystemInsets() {
  return useContext(SafeAreaInsetsContext) ?? NONE;
}
