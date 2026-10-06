import { describe, expect, it } from 'vitest';
import { assertPlayReady, loadConfig } from '../src/config';

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
