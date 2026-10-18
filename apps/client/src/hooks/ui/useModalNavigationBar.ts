import { useEffect } from 'react';
import { useTheme } from '@/src/theme';
import { isColorLight } from '@/src/theme/commonStyles';
import { applyNavigationBarStyle } from '@/src/utils/platform/navigationBarStyle';

/**
 * When the modal's window has settled: its first frame, and after its fade or slide has run. The native
 * side restyles a modal's window as it appears and again when its props update, so one call right after
 * mounting can land before the last of them.
 */
const SETTLE_DELAYS_MS = [0, 150, 450];

/**
 * Keeps Android's navigation bar buttons on the app's palette while a `Modal` is open.
 *
 * Call it from whatever renders a `Modal`: `visible` is the modal's own flag (`true` for one that is
 * only mounted while it shows). The app's window is styled by `<NavigationBar>` in `App.tsx`; a modal
 * is another window, which React Native styles after the system's scheme - so a dark app on a light
 * phone showed a modal with the wrong buttons. See `applyNavigationBarStyle`.
 */
export function useModalNavigationBar(visible: boolean): void {
  const { colors } = useTheme();
  const style = isColorLight(colors.background) ? 'dark' : 'light';

  useEffect(() => {
    if (!visible) return;
    const timers = SETTLE_DELAYS_MS.map((delay) =>
      setTimeout(() => applyNavigationBarStyle(style), delay),
    );
    return () => timers.forEach(clearTimeout);
  }, [visible, style]);
}
