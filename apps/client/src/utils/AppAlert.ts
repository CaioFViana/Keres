import type { AppAlertButton, AppAlertOptions } from '../state/appAlertStore';
import { useAppAlertStore } from '../state/appAlertStore';

/**
 * A replacement for React Native's `Alert.alert`: on the web, `react-native-web`'s Alert is a silent
 * no-op (`static alert() {}` - node_modules/react-native-web/dist/exports/Alert), so any confirmation
 * (delete a story, discard changes...) simply did not appear. The same signature as `Alert.alert`, so
 * swapping the import is enough - the real UI is a `Modal` (`AppAlertHost`, mounted once in `App.tsx`),
 * which already works on every platform (the same base as `NotificationPopup`, which always worked on
 * the web).
 */
export const AppAlert = {
  alert(
    title: string,
    message?: string,
    buttons?: AppAlertButton[],
    options?: AppAlertOptions,
  ): void {
    useAppAlertStore.getState().show(title, message, buttons, options);
  },
};
