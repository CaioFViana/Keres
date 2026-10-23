/**
 * @jest-environment node
 */
import { defaultServerUrl, isDefaultServerUrl } from '@/src/utils/auth/defaultServer';

const mockFlavor = { hosted: false, origin: 'https://hosted.example' };

jest.mock('@/src/utils/platform/clientFlavor', () => ({
  __esModule: true,
  isHostedByApi: () => mockFlavor.hosted,
}));

jest.mock('@/src/services/auth/browserCookieSession', () => ({
  __esModule: true,
  hostedApiOrigin: () => mockFlavor.origin,
}));

beforeEach(() => {
  mockFlavor.hosted = false;
  mockFlavor.origin = 'https://hosted.example';
});

describe('defaultServerUrl', () => {
  it('is the official Keres server in the native apps and the desktop shell', () => {
    expect(defaultServerUrl()).toBe('https://keres.me');
  });

  it('is the origin that serves the hosted web client, which can talk to no other server', () => {
    mockFlavor.hosted = true;

    expect(defaultServerUrl()).toBe('https://hosted.example');
  });
});

describe('isDefaultServerUrl', () => {
  it('recognises the official server, with or without a trailing slash', () => {
    expect(isDefaultServerUrl('https://keres.me')).toBe(true);
    expect(isDefaultServerUrl('https://keres.me/')).toBe(true);
    expect(isDefaultServerUrl('https://keres.me///')).toBe(true);
  });

  it('ignores the case of the host and the default HTTPS port', () => {
    expect(isDefaultServerUrl('https://KERES.me')).toBe(true);
    expect(isDefaultServerUrl('https://keres.me:443')).toBe(true);
    expect(isDefaultServerUrl('https://Keres.ME:443/')).toBe(true);
  });

  it('does not match another server, or the official one on another port or scheme', () => {
    expect(isDefaultServerUrl('https://keres.me:8443')).toBe(false);
    expect(isDefaultServerUrl('http://keres.me')).toBe(false);
    expect(isDefaultServerUrl('https://other.example')).toBe(false);
    expect(isDefaultServerUrl('https://keres.me.evil.example')).toBe(false);
  });

  it('matches the hosted origin when the app is the hosted web client', () => {
    mockFlavor.hosted = true;

    expect(isDefaultServerUrl('https://hosted.example/')).toBe(true);
    expect(isDefaultServerUrl('https://keres.me')).toBe(false);
  });
});
