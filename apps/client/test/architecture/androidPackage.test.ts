/** @jest-environment node */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const APP_JSON = resolve(__dirname, '../../app.json');

/**
 * The Android application id: the Play listing's identity, immutable after the first upload.
 * It must stay the official package - a placeholder would land uploads on the wrong listing,
 * and store purchases verify against this package at runtime (see `playPurchase.android`).
 */
describe('the Android package', () => {
  it('is the official package, never the Expo placeholder', () => {
    const config = JSON.parse(readFileSync(APP_JSON, 'utf8')) as {
      expo?: { android?: { package?: string } };
    };

    expect(config.expo?.android?.package).toBe('me.keres.client');
  });
});
