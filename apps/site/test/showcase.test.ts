import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { SHOWCASE_SCREENS } from '../src/content/catalog';
import en from '../src/i18n/locales/site.en.json';
import pt from '../src/i18n/locales/site.pt.json';

/**
 * A vitrine é a única parte da landing cujo conteúdo não está no repositório como texto: as
 * fotos vêm de `apps/desktop/scripts/capture-screens.cjs`, que abre o app no Electron e
 * fotografa a tela. Se uma faltar, a página publica um quadrado quebrado - e isso não aparece
 * em nenhum outro teste.
 */
const screensDirectory = join(__dirname, '../public/showcase/screens');
const LANGUAGES = ['en', 'pt'] as const;
const THEMES = ['light', 'dark'] as const;
const fileOf = (id: string, language: string, theme: string) =>
  join(screensDirectory, `${id}.${language}.${theme}.png`);

/** Assinatura PNG: 8 bytes fixos no começo de todo arquivo válido. */
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** Largura e altura moram no cabeçalho IHDR, logo depois da assinatura. */
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

  /** A captura já falhou entregando PNG em branco; tamanho e cabeçalho pegam isso. */
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

  /** Claro e escuro têm que ser fotos diferentes; iguais significa tema não aplicado. */
  it('diferencia a tela clara da escura', () => {
    for (const screen of SHOWCASE_SCREENS) {
      const light = readFileSync(fileOf(screen.id, 'en', 'light'));
      const dark = readFileSync(fileOf(screen.id, 'en', 'dark'));
      expect(light.equals(dark)).toBe(false);
    }
  });

  /** O app inteiro é traduzido, inclusive as histórias de exemplo: a foto muda com o idioma. */
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
