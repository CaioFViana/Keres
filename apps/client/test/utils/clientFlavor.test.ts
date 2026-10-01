/** @jest-environment jsdom */
import { Platform } from 'react-native';
import {
  getClientFlavor,
  isHostedByApi,
  isOfficialApp,
  isServerless,
} from '../../src/utils/clientFlavor';

const original = { os: Platform.OS, serverless: process.env.EXPO_PUBLIC_SERVERLESS };
const setOs = (os: 'ios' | 'android' | 'web') => {
  Platform.OS = os;
};
const bridges = window as unknown as { keresAuth?: unknown; keresMedia?: unknown };

afterEach(() => {
  Platform.OS = original.os;
  if (original.serverless === undefined) delete process.env.EXPO_PUBLIC_SERVERLESS;
  else process.env.EXPO_PUBLIC_SERVERLESS = original.serverless;
  delete bridges.keresAuth;
  delete bridges.keresMedia;
  document.head.innerHTML = '';
});

describe('getClientFlavor', () => {
  it.each(['ios', 'android'] as const)('is the native app on %s', (os) => {
    setOs(os);
    expect(getClientFlavor()).toBe('native');
  });

  it('is the desktop shell when the Electron preload exposed its bridges', () => {
    setOs('web');
    bridges.keresMedia = {};
    expect(getClientFlavor()).toBe('desktop');
    delete bridges.keresMedia;
    bridges.keresAuth = {};
    expect(getClientFlavor()).toBe('desktop');
  });

  it('is the web client in a browser with no bridge, hosted by the API or served locally alike', () => {
    setOs('web');
    expect(getClientFlavor()).toBe('web');
    document.head.innerHTML = '<meta name="keres-hosted" content="1" />';
    expect(getClientFlavor()).toBe('web');
  });

  it('is the serverless web build when the build says so, whatever the platform reports', () => {
    process.env.EXPO_PUBLIC_SERVERLESS = '1';
    setOs('web');
    expect(getClientFlavor()).toBe('serverless-web');
    setOs('ios');
    expect(getClientFlavor()).toBe('serverless-web');
    expect(isServerless()).toBe(true);
  });

  it('only counts the build input "1" as serverless', () => {
    process.env.EXPO_PUBLIC_SERVERLESS = '0';
    setOs('web');
    expect(isServerless()).toBe(false);
  });
});

describe('what the flavor means', () => {
  it('counts the mobile and desktop apps as the official ones, and no browser build', () => {
    expect(isOfficialApp('native')).toBe(true);
    expect(isOfficialApp('desktop')).toBe(true);
    expect(isOfficialApp('web')).toBe(false);
    expect(isOfficialApp('serverless-web')).toBe(false);
  });

  it('is hosted by the API only on the web build whose HTML carries the marker', () => {
    setOs('web');
    expect(isHostedByApi()).toBe(false);
    document.head.innerHTML = '<meta name="keres-hosted" content="1" />';
    expect(isHostedByApi()).toBe(true);

    // The desktop shell and the other builds never take the cookie session, marker or not.
    bridges.keresAuth = {};
    expect(isHostedByApi()).toBe(false);
    delete bridges.keresAuth;
    setOs('ios');
    expect(isHostedByApi()).toBe(false);
    process.env.EXPO_PUBLIC_SERVERLESS = '1';
    setOs('web');
    expect(isHostedByApi()).toBe(false);
  });
});
