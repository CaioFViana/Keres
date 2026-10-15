import {
  blocksNewAccounts,
  isLoopbackHost,
  isOpenableVerificationUrl,
} from '@/src/utils/ageVerificationRules';

describe('blocksNewAccounts', () => {
  it('blocks only a server that requires verification and cannot run it right now', () => {
    expect(blocksNewAccounts({ mode: 'required', available: false })).toBe(true);
    expect(blocksNewAccounts({ mode: 'required', available: true })).toBe(false);
    expect(blocksNewAccounts({ mode: 'manual', available: false })).toBe(false);
  });

  it('never blocks on an unreadable answer: the server itself decides then', () => {
    expect(blocksNewAccounts(null)).toBe(false);
  });
});

describe('isLoopbackHost', () => {
  it.each(['localhost', 'LOCALHOST', 'localhost.', '127.0.0.1', '[::1]', 'verify.localhost'])(
    'takes %s for this device',
    (host) => {
      expect(isLoopbackHost(host)).toBe(true);
    },
  );

  it.each([
    '192.168.1.10',
    '10.0.0.5',
    '172.16.0.9',
    'mypc.local',
    'localhost.example.com',
    '127.0.0.1.nip.io',
  ])('does not take %s for this device', (host) => {
    expect(isLoopbackHost(host)).toBe(false);
  });
});

describe('isOpenableVerificationUrl', () => {
  it('opens https addresses', () => {
    expect(isOpenableVerificationUrl('https://verify.example/v/token')).toBe(true);
    expect(isOpenableVerificationUrl('https://192.168.1.10:3102/v/token')).toBe(true);
  });

  // The hosted web build and the development build must agree: a person running their own server on this machine
  // gets the link in both, so the check cannot depend on `__DEV__`.
  it.each([
    'http://127.0.0.1:3102/v/token',
    'http://localhost:3102/v/token',
    'http://[::1]:3102/v/token',
    'http://verify.localhost:3102/v/token',
  ])('opens plain http to this device (%s), in every build', (url) => {
    expect(isOpenableVerificationUrl(url)).toBe(true);
  });

  it.each([
    'http://192.168.1.10:3102/v/token',
    'http://10.0.0.5:3102/v/token',
    'http://verify.example/v/token',
    'http://127.0.0.1.nip.io/v/token',
  ])('refuses plain http to %s', (url) => {
    expect(isOpenableVerificationUrl(url)).toBe(false);
  });

  it.each([
    'javascript:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    'intent://evil',
    'not a url',
    '',
  ])('refuses %s', (url) => {
    expect(isOpenableVerificationUrl(url)).toBe(false);
  });
});
