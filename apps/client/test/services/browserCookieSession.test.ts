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

function setHostedMeta(present: boolean) {
  document.head.innerHTML = present ? '<meta name="keres-hosted" content="1" />' : '';
}

afterEach(() => {
  setPlatform(originalOS);
  delete (window as { keresAuth?: unknown }).keresAuth;
  document.head.innerHTML = '';
});

describe('usesHttpOnlyCookieSession', () => {
  it('is false on native', () => {
    setPlatform('ios');
    setHostedMeta(true);
    expect(usesHttpOnlyCookieSession()).toBe(false);
  });

  it('is false in the Electron renderer', () => {
    setPlatform('web');
    window.keresAuth = { status: async () => ({ available: true }) } as Window['keresAuth'];
    setHostedMeta(true);
    expect(usesHttpOnlyCookieSession()).toBe(false);
  });

  it('is true only when the API marked the HTML as co-hosted', () => {
    setPlatform('web');
    Object.defineProperty(window, 'location', {
      value: { pathname: '/', origin: 'http://localhost:3000' },
      configurable: true,
    });
    setHostedMeta(true);
    expect(usesHttpOnlyCookieSession()).toBe(true);
    expect(hostedApiOrigin()).toBe('http://localhost:3000');
    expect(canRefreshSessionWithCookie('http://localhost:3000')).toBe(true);
    expect(canRefreshSessionWithCookie('http://other.example')).toBe(false);
  });

  it('is false on expo start --web, which has no hosted meta tag', () => {
    setPlatform('web');
    Object.defineProperty(window, 'location', {
      value: { pathname: '/', origin: 'http://localhost:8081' },
      configurable: true,
    });
    setHostedMeta(false);
    expect(usesHttpOnlyCookieSession()).toBe(false);
  });
});
