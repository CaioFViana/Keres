import type { PaymentMethodOption } from '@keres/shared';
import {
  visiblePaymentMethods,
  type DevicePaymentCapabilities,
} from '../../src/utils/paymentMethodVisibility';

const redirect = (id: string): PaymentMethodOption => ({ id, label: id, flow: 'redirect' });
// A connector that predates `flow` says nothing about it.
const legacy = (id: string): PaymentMethodOption => ({ id, label: id });
const play = (): PaymentMethodOption => ({
  id: 'playbilling',
  label: 'Google Play',
  flow: 'native',
  store: 'play',
});
const appstore = (): PaymentMethodOption => ({
  id: 'appstore',
  label: 'App Store',
  flow: 'native',
  store: 'appstore',
});

const methods = [redirect('paypal'), redirect('googlepay'), legacy('pix'), play(), appstore()];
const ids = (list: PaymentMethodOption[]) => list.map((method) => method.id);

const web: DevicePaymentCapabilities = { flavor: 'web', platform: 'web', nativePay: false };
const desktop: DevicePaymentCapabilities = {
  flavor: 'desktop',
  platform: 'windows',
  nativePay: false,
};
const androidNoRuntime: DevicePaymentCapabilities = {
  flavor: 'native',
  platform: 'android',
  nativePay: false,
};
const android: DevicePaymentCapabilities = { ...androidNoRuntime, nativePay: true };
const iosPay: DevicePaymentCapabilities = {
  flavor: 'native',
  platform: 'ios',
  nativePay: true,
};

describe('payment method visibility', () => {
  it('shows the redirect methods on web and desktop, never the store ones', () => {
    expect(ids(visiblePaymentMethods(methods, web))).toEqual(['paypal', 'googlepay', 'pix']);
    expect(ids(visiblePaymentMethods(methods, desktop))).toEqual(['paypal', 'googlepay', 'pix']);
  });

  it('treats a method without flow as a redirect, for older connectors', () => {
    expect(ids(visiblePaymentMethods([legacy('boleto')], web))).toEqual(['boleto']);
  });

  it('shows nothing on mobile while no native purchase runtime exists', () => {
    expect(visiblePaymentMethods(methods, androidNoRuntime)).toEqual([]);
  });

  it('shows only the Play method on Android once native pay exists', () => {
    expect(ids(visiblePaymentMethods(methods, android))).toEqual(['playbilling']);
  });

  it('shows only the App Store method on iOS once native pay exists', () => {
    expect(ids(visiblePaymentMethods(methods, iosPay))).toEqual(['appstore']);
  });

  it('returns nothing for nothing', () => {
    expect(visiblePaymentMethods(null, web)).toEqual([]);
    expect(visiblePaymentMethods(undefined, web)).toEqual([]);
    expect(visiblePaymentMethods([], web)).toEqual([]);
  });
});
