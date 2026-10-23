/**
 * @jest-environment node
 */
import {
  defaultServerUrl,
  isDefaultServerUrl,
  serverDisplayName,
} from '@/src/utils/auth/defaultServer';

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

const t = (key: string) => `t:${key}`;

describe('serverDisplayName', () => {
  it('calls the official server by a translated name when it has none of its own', () => {
    expect(serverDisplayName({ name: 'https://keres.me', url: 'https://keres.me' }, t)).toBe(
      't:official_server_name',
    );
    expect(serverDisplayName({ name: null, url: 'https://keres.me/' }, t)).toBe(
      't:official_server_name',
    );
    expect(serverDisplayName({ name: '  ', url: 'https://keres.me' }, t)).toBe(
      't:official_server_name',
    );
    // A name that is only the address, written another way, is still no name.
    expect(serverDisplayName({ name: 'https://KERES.me/', url: 'https://keres.me' }, t)).toBe(
      't:official_server_name',
    );
  });

  it('keeps a name somebody gave the official server', () => {
    expect(serverDisplayName({ name: 'My cloud', url: 'https://keres.me' }, t)).toBe('My cloud');
  });

  it('shows another server by its name, or its address when it has none', () => {
    expect(serverDisplayName({ name: 'Friends', url: 'https://s.example' }, t)).toBe('Friends');
    expect(serverDisplayName({ name: '', url: 'https://s.example' }, t)).toBe('https://s.example');
    expect(serverDisplayName({ name: 'https://s.example', url: 'https://s.example' }, t)).toBe(
      'https://s.example',
    );
  });

  it('does not take the hosting server for the official one', () => {
    mockFlavor.hosted = true;

    expect(
      serverDisplayName({ name: 'https://hosted.example', url: 'https://hosted.example' }, t),
    ).toBe('https://hosted.example');
  });
});
