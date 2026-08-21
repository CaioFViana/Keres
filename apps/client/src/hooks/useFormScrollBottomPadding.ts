import { useEffect, useState } from 'react';
import { Dimensions, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * Height (dp) of Android's on-screen navigation bar (3-button or gesture pill), measured
 * directly instead of assumed.
 *
 * `useSafeAreaInsets().bottom` is *not* a reliable source for this on Android: whether it
 * reports the nav bar's height depends on whether the window is actually drawing edge-to-edge,
 * which in turn depends on the OS version, the OEM skin, and Expo/RN defaults that have shifted
 * across SDKs regardless of `app.json`'s `edgeToEdgeEnabled` - on several combinations it comes
 * back 0 even though the bar is visible and covering content. `Dimensions.get('screen')` (the
 * full physical display) versus `Dimensions.get('window')` (what's actually available to the
 * app) doesn't have that problem: their difference *is* the space the system bars are taking,
 * measured, not inferred from a flag whose real effect we can't fully control from JS.
 */
function androidNavigationBarHeight(): number {
  if (Platform.OS !== 'android') {
    return 0;
  }
  const diff = Dimensions.get('screen').height - Dimensions.get('window').height;
  return diff > 0 ? diff : 0;
}

/**
 * Bottom padding for a form/detail screen's ScrollView, so its last field or button is never
 * left underneath the device's home indicator, gesture bar, or (Android) on-screen nav buttons.
 *
 * Several form screens used to carry a fixed `paddingBottom: 350` plus a trailing empty
 * `<View style={{ height: 90 }} />` at the end of the ScrollView - a blind "add space until it
 * looks right on my device" workaround. It neither adapted to the actual safe-area inset (0 on
 * older phones, 34+ on notched ones) nor to how much content preceded it, so it under-shot on
 * some devices and wasted scroll room on others - most noticeably on screens whose content is
 * already long, like a Scene's or Choice's form.
 *
 * On Android the effective inset is whichever of the two sources actually reports space taken
 * (`Math.max`, not either one alone), since which one is accurate varies by device; on iOS the
 * home indicator is already included in `insets.bottom`, so nothing else is needed there.
 */
export function useFormScrollBottomPadding(margin = 24): number {
  const insets = useSafeAreaInsets();
  const [measuredAndroidNavBar, setMeasuredAndroidNavBar] = useState(androidNavigationBarHeight);

  useEffect(() => {
    if (Platform.OS !== 'android') {
      return;
    }
    const subscription = Dimensions.addEventListener('change', () => {
      setMeasuredAndroidNavBar(androidNavigationBarHeight());
    });
    return () => subscription.remove();
  }, []);

  const bottomAllowance =
    Platform.OS === 'android' ? Math.max(insets.bottom, measuredAndroidNavBar) : insets.bottom;

  return bottomAllowance + margin;
}
