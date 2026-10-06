import { describe, expect, it } from 'vitest';
import { assertPlayReady, configProblems, loadConfig } from '../src/config';

const BASE = {
  KERES_CONNECTOR_SECRET: 'connector-secret-0123456789abcdef',
  KERES_BASE_URL: 'http://127.0.0.1:3000',
  KERES_EVENTS_SECRET: 'events-secret-0123456789abcdef-00',
  PUBLIC_BASE_URL: 'http://127.0.0.1:3101',
} as NodeJS.ProcessEnv;

describe('payments config', () => {
  it('loads defaults with no provider configured', () => {
    const config = loadConfig({ ...BASE });
    expect(config.port).toBe(3101);
    expect(config.paypal).toBeNull();
    expect(config.stripe).toBeNull();
    expect(config.play).toBeNull();
  });

  it('enables providers only when their keys are present', () => {
    const config = loadConfig({
      ...BASE,
      PAYPAL_CLIENT_ID: 'id',
      PAYPAL_SECRET: 'secret',
      STRIPE_SECRET_KEY: 'sk',
      STRIPE_WEBHOOK_SECRET: 'whsec',
      PLAY_ENDPOINT_SECRET: 'play-secret-0123456789abcdef-0000',
    });
    expect(config.paypal?.sandbox).toBe(true);
    expect(config.stripe).not.toBeNull();
    expect(config.play).toEqual({
      endpointSecret: 'play-secret-0123456789abcdef-0000',
      mock: false,
      notificationSecret: null,
      packageName: null,
      acceptTestPurchases: false,
    });
  });

  it('enables Play mock only when explicitly asked', () => {
    const config = loadConfig({
      ...BASE,
      PLAY_ENDPOINT_SECRET: 'play-secret-0123456789abcdef-0000',
      PLAY_MOCK: 'true',
    });
    expect(config.play?.mock).toBe(true);
  });

  it('holds the Play secrets to the same length as every other key', () => {
    expect(() => loadConfig({ ...BASE, PLAY_ENDPOINT_SECRET: 'short' })).toThrow(
      'at least 32 characters',
    );
    const withNotifications = loadConfig({
      ...BASE,
      PLAY_ENDPOINT_SECRET: 'play-secret-0123456789abcdef-0000',
      PLAY_NOTIFICATION_SECRET: 'push-secret-0123456789abcdef-0000',
    });
    expect(withNotifications.play?.notificationSecret).toBe('push-secret-0123456789abcdef-0000');
    expect(() =>
      loadConfig({
        ...BASE,
        PLAY_ENDPOINT_SECRET: 'play-secret-0123456789abcdef-0000',
        PLAY_NOTIFICATION_SECRET: 'short',
      }),
    ).toThrow('at least 32 characters');
  });

  it('refuses short secrets and equal keys', () => {
    expect(() => loadConfig({ ...BASE, KERES_CONNECTOR_SECRET: 'short' })).toThrow(
      'at least 32 characters',
    );
    expect(() => loadConfig({ ...BASE, KERES_EVENTS_SECRET: BASE.KERES_CONNECTOR_SECRET })).toThrow(
      'must differ',
    );
  });

  it('refuses live Play without the service-account key', () => {
    const live = loadConfig({ ...BASE, PLAY_ENDPOINT_SECRET: 'play-secret-0123456789abcdef-0000' });
    expect(() => assertPlayReady(live, { ...BASE })).toThrow('PLAY_SERVICE_ACCOUNT_JSON');
    expect(() =>
      assertPlayReady(live, { ...BASE, PLAY_SERVICE_ACCOUNT_JSON: '{"key":"x"}' }),
    ).not.toThrow();
    const mock = loadConfig({
      ...BASE,
      PLAY_ENDPOINT_SECRET: 'play-secret-0123456789abcdef-0000',
      PLAY_MOCK: 'true',
    });
    expect(() => assertPlayReady(mock, { ...BASE })).not.toThrow();
    expect(() => assertPlayReady(loadConfig({ ...BASE }), { ...BASE })).not.toThrow();
  });

  it('refuses plain http outside loopback', () => {
    expect(() => loadConfig({ ...BASE, KERES_BASE_URL: 'http://example.com' })).toThrow(
      'must be https',
    );
    expect(() =>
      loadConfig({ ...BASE, ALLOW_INSECURE_HTTP: 'true', KERES_BASE_URL: 'http://example.com' }),
    ).not.toThrow();
  });
});

describe('configuration that loads but is half set', () => {
  const problems = (extra: Record<string, string> = {}) => {
    const env = { ...BASE, ...extra } as NodeJS.ProcessEnv;
    return configProblems(loadConfig(env), env);
  };

  it('has nothing to say about a configuration with nothing half set', () => {
    expect(problems()).toEqual({ fatal: [], warnings: [] });
    expect(
      problems({
        PAYPAL_CLIENT_ID: 'id',
        PAYPAL_SECRET: 'secret',
        PAYPAL_WEBHOOK_ID: 'WH-1',
        PAYPAL_SANDBOX: 'false',
        STRIPE_SECRET_KEY: 'sk',
        STRIPE_WEBHOOK_SECRET: 'whsec',
      }),
    ).toEqual({ fatal: [], warnings: [] });
  });

  it('warns when PayPal is on a sandbox without its webhook: renewals would never be heard', () => {
    const found = problems({ PAYPAL_CLIENT_ID: 'id', PAYPAL_SECRET: 'secret' });

    expect(found.fatal).toEqual([]);
    expect(found.warnings.join(' ')).toContain('PAYPAL_WEBHOOK_ID');
  });

  it('refuses to start a LIVE PayPal without its webhook', () => {
    const found = problems({
      PAYPAL_CLIENT_ID: 'id',
      PAYPAL_SECRET: 'secret',
      PAYPAL_SANDBOX: 'false',
    });

    expect(found.fatal.join(' ')).toContain('PAYPAL_WEBHOOK_ID');
  });

  it('says a provider is off when only half of its pair is set', () => {
    expect(problems({ PAYPAL_CLIENT_ID: 'id' }).warnings.join(' ')).toContain('PayPal is OFF');
    expect(problems({ STRIPE_SECRET_KEY: 'sk' }).warnings.join(' ')).toContain(
      'Google Pay (Stripe) is OFF',
    );
    expect(problems({ STRIPE_WEBHOOK_SECRET: 'whsec' }).warnings.join(' ')).toContain(
      'Google Pay (Stripe) is OFF',
    );
  });

  it('warns when live Play has no notification secret, but not in mock mode', () => {
    const play = { PLAY_ENDPOINT_SECRET: 'play-secret-0123456789abcdef-0000' };

    expect(problems(play).warnings.join(' ')).toContain('PLAY_NOTIFICATION_SECRET');
    expect(problems({ ...play, PLAY_MOCK: 'true' }).warnings).toEqual([]);
    expect(
      problems({
        ...play,
        PLAY_NOTIFICATION_SECRET: 'push-secret-0123456789abcdef-0000',
        PLAY_PACKAGE_NAME: 'me.keres.app',
      }).warnings,
    ).toEqual([]);
  });

  it('warns when live Play has no package name (cancelling from here is off), and when test purchases count', () => {
    const play = {
      PLAY_ENDPOINT_SECRET: 'play-secret-0123456789abcdef-0000',
      PLAY_NOTIFICATION_SECRET: 'push-secret-0123456789abcdef-0000',
    };

    expect(problems(play).warnings.join(' ')).toContain('PLAY_PACKAGE_NAME');
    expect(
      problems({
        ...play,
        PLAY_PACKAGE_NAME: 'me.keres.app',
        PLAY_ACCEPT_TEST_PURCHASES: 'true',
      }).warnings.join(' '),
    ).toContain('PLAY_ACCEPT_TEST_PURCHASES');
  });

  it('warns about a public address in plain http away from this machine', () => {
    const found = problems({
      ALLOW_INSECURE_HTTP: 'true',
      PUBLIC_BASE_URL: 'http://pay.example.com',
    });

    expect(found.warnings.join(' ')).toContain('PUBLIC_BASE_URL');
  });
});
