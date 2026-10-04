import type { PaymentMethodOption } from '@keres/shared';
import { Platform } from 'react-native';
import { getClientFlavor, type ClientFlavor } from './clientFlavor';

/** What this build can execute, for payment-method filtering. */
export interface DevicePaymentCapabilities {
  flavor: ClientFlavor;
  platform: typeof Platform.OS;
  /**
   * Whether a native store purchase can run here: the Android app with the store SDK linked. Anywhere
   * else a native-only method is unusable, and the screen says so instead of offering a payment that
   * cannot start. (In Expo Go the import still fails at buy time, and buying is refused cleanly.)
   */
  nativePay: boolean;
}

export function devicePaymentCapabilities(): DevicePaymentCapabilities {
  const flavor = getClientFlavor();
  const platform = Platform.OS;
  return { flavor, platform, nativePay: flavor === 'native' && platform === 'android' };
}

const flowOf = (method: PaymentMethodOption): 'redirect' | 'native' => method.flow ?? 'redirect';

/**
 * The server's methods this device can actually pay with. Web and desktop run the redirect
 * checkouts (PayPal, Google Pay on the web); the Android app only ever offers the Play store
 * method and never the web ones (the Play Store policy forbids web checkouts for digital goods
 * inside apps); iOS offers its store method once it exists. A method the server sells but this
 * device cannot run is left out: the screen tells the person it is unavailable instead.
 */
export function visiblePaymentMethods(
  methods: readonly PaymentMethodOption[] | null | undefined,
  device: DevicePaymentCapabilities = devicePaymentCapabilities(),
): PaymentMethodOption[] {
  if (!methods) return [];
  if (device.flavor === 'native') {
    if (!device.nativePay) return [];
    if (device.platform === 'android') {
      return methods.filter(
        (method) => flowOf(method) === 'native' && (method.store ?? 'play') === 'play',
      );
    }
    return methods.filter((method) => flowOf(method) === 'native' && method.store === 'appstore');
  }
  return methods.filter((method) => flowOf(method) === 'redirect');
}
