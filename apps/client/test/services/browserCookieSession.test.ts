/**
 * @jest-environment jsdom
 */
import { Platform } from 'react-native';
import {
  canRefreshSessionWithCookie,
  hostedApiOrigin,
  usesHttpOnlyCookieSession,
} from '../../src/services/browserCookieSession';

const originalOS = Platform.OS;

const setPlatform = (os: string) => {
  Object.defineProperty(Platform, 'OS', { value: os, configurable: true });
};

afterEach(() => {
  setPlatform(originalOS);
  delete (window as { keresAuth?: unknown }).keresAuth;
});

describe('usesHttpOnlyCookieSession', () => {
  it('is false on native', () => {
    setPlatform('ios');
    expect(usesHttpOnlyCookieSession()).toBe(false);
  });

  it('is false in the Electron renderer', () => {
    setPlatform('web');
    window.keresAuth = { status: async () => ({ available: true }) } as Window['keresAuth'];
    Object.defineProperty(window, 'location', {
      value: { pathname: '/app', origin: 'http://localhost:3000' },
      configurable: true,
    });
    expect(usesHttpOnlyCookieSession()).toBe(false);
  });

  it('is true only for the co-hosted /app client without the Electron bridge', () => {
    setPlatform('web');
    Object.defineProperty(window, 'location', {
      value: { pathname: '/app', origin: 'http://localhost:3000' },
      configurable: true,
    });
    expect(usesHttpOnlyCookieSession()).toBe(true);
    expect(hostedApiOrigin()).toBe('http://localhost:3000');
    expect(canRefreshSessionWithCookie('http://localhost:3000')).toBe(true);
    expect(canRefreshSessionWithCookie('http://other.example')).toBe(false);
  });

  it('is false on expo start --web, which is not under /app', () => {
    setPlatform('web');
    Object.defineProperty(window, 'location', {
      value: { pathname: '/', origin: 'http://localhost:8081' },
      configurable: true,
    });
    expect(usesHttpOnlyCookieSession()).toBe(false);
  });
});
