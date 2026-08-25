import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { SHOWCASE_SCREENS } from '../src/content/catalog';
import en from '../src/i18n/locales/site.en.json';
import pt from '../src/i18n/locales/site.pt.json';

/**
 * The showcase is the only part of the landing page whose content is not in the repository as
 * text: the screenshots come from `apps/desktop/scripts/capture-screens.ts`, which opens the app
 * in Electron and photographs the screen. If one goes missing, the page publishes a broken square
 * - and no other test catches that.
 */
const screensDirectory = join(__dirname, '../public/showcase/screens');
const LANGUAGES = ['en', 'pt'] as const;
const THEMES = ['light', 'dark'] as const;
const fileOf = (id: string, language: string, theme: string) =>
  join(screensDirectory, `${id}.${language}.${theme}.png`);

/** PNG signature: 8 fixed bytes at the start of every valid file. */
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** Width and height live in the IHDR header, right after the signature. */
function pngSize(file: string): { width: number; height: number } {
  const header = readFileSync(file).subarray(0, 24);
  return { width: header.readUInt32BE(16), height: header.readUInt32BE(20) };
}

describe('vitrine', () => {
  it('tem cada tela nos dois idiomas e nos dois temas', () => {
    const missing = SHOWCASE_SCREENS.flatMap((screen) =>
      LANGUAGES.flatMap((language) =>
        THEMES.map((theme) => fileOf(screen.id, language, theme)).filter(
          (file) => !existsSync(file),
        ),
      ),
    );

    expect(missing).toEqual([]);
  });

  /** The capture has already failed by producing a blank PNG; size and header catch that. */
  it('grava PNG de verdade, no tamanho que a página anuncia', () => {
    for (const screen of SHOWCASE_SCREENS) {
      for (const language of LANGUAGES) {
        for (const theme of THEMES) {
          const file = fileOf(screen.id, language, theme);
          expect(readFileSync(file).subarray(0, 8).equals(PNG_SIGNATURE)).toBe(true);
          expect(statSync(file).size).toBeGreaterThan(10_000);
          expect(pngSize(file)).toEqual({ width: screen.width, height: screen.height });
        }
      }
    }
  });

  /** Light and dark have to be different photos; identical ones mean the theme was not applied. */
  it('diferencia a tela clara da escura', () => {
    for (const screen of SHOWCASE_SCREENS) {
      const light = readFileSync(fileOf(screen.id, 'en', 'light'));
      const dark = readFileSync(fileOf(screen.id, 'en', 'dark'));
      expect(light.equals(dark)).toBe(false);
    }
  });

  /** The whole app is translated, example stories included: the photo changes with the language. */
  it('fotografa em português e em inglês', () => {
    for (const screen of SHOWCASE_SCREENS) {
      const english = readFileSync(fileOf(screen.id, 'en', 'light'));
      const portuguese = readFileSync(fileOf(screen.id, 'pt', 'light'));
      expect(english.equals(portuguese)).toBe(false);
    }
  });

  it('tem título e descrição nos dois idiomas', () => {
    for (const locale of [en, pt]) {
      const items = (locale as { showcase: { items: Record<string, unknown> } }).showcase.items;
      for (const screen of SHOWCASE_SCREENS) {
        expect(items[screen.id]).toMatchObject({
          title: expect.any(String),
          body: expect.any(String),
        });
      }
    }
  });

  it('tem os textos da foto ampliada nos dois idiomas', () => {
    for (const locale of [en, pt]) {
      expect((locale as { showcase: { lightbox: unknown } }).showcase.lightbox).toMatchObject({
        close: expect.any(String),
        zoom: expect.any(String),
        shrink: expect.any(String),
      });
    }
  });

  it('não deixa texto de tela que saiu da vitrine para trás', () => {
    const ids = SHOWCASE_SCREENS.map((screen) => screen.id).sort();
    for (const locale of [en, pt]) {
      const items = (locale as { showcase: { items: Record<string, unknown> } }).showcase.items;
      expect(Object.keys(items).sort()).toEqual(ids);
    }
  });
});
