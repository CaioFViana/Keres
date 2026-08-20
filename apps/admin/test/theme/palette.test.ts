import { getColorLuminance, themes } from '@keres/shared';
import { afterEach, describe, expect, it } from 'vitest';
import {
  applyPalette,
  PALETTE_NAMES,
  paletteLabel,
  readPaletteName,
  THEME_PALETTE_KEY,
  writePaletteName,
} from '../../src/theme/theme';

function cssVar(name: string): string {
  return document.documentElement.style.getPropertyValue(name);
}

/**
 * Diferença de luminância entre duas cores. Não é a razão de contraste da WCAG, mas separa com
 * folga o caso que motivou este teste - texto claro sobre fundo claro - de um par utilizável.
 */
function luminanceGap(first: string, second: string): number {
  return Math.abs((getColorLuminance(first) ?? 0) - (getColorLuminance(second) ?? 0));
}

afterEach(() => {
  applyPalette('default', 'light');
  localStorage.removeItem(THEME_PALETTE_KEY);
});

describe('admin palette selection', () => {
  it('defaults to the palette that matches the panel original look', () => {
    expect(readPaletteName()).toBe('default');
  });

  it('remembers a chosen palette and ignores one it does not know', () => {
    writePaletteName('twilight');
    expect(readPaletteName()).toBe('twilight');

    writePaletteName('not-a-palette');
    expect(readPaletteName()).toBe('default');
  });

  it('labels palettes readably', () => {
    expect(paletteLabel('seaOfStars')).toBe('Sea Of Stars');
    expect(paletteLabel('default')).toBe('Default');
  });

  it('offers every shared palette', () => {
    expect(PALETTE_NAMES).toEqual(Object.keys(themes));
    expect(PALETTE_NAMES.length).toBeGreaterThan(1);
  });

  // O CSS do painel já traz a paleta default; escrever variáveis por cima seria redundante e
  // faria "voltar ao padrão" depender de as duas cópias continuarem iguais.
  it('writes no variables for the default palette', () => {
    applyPalette('twilight', 'light');
    expect(cssVar('--color-sidebar-bg')).not.toBe('');

    applyPalette('default', 'light');
    expect(cssVar('--color-sidebar-bg')).toBe('');
    expect(cssVar('--color-primary')).toBe('');
  });

  it('applies the palette colors of the active mode', () => {
    applyPalette('twilight', 'dark');
    expect(cssVar('--color-primary')).toBe(themes.twilight.darkColors.primary);

    applyPalette('twilight', 'light');
    expect(cssVar('--color-primary')).toBe(themes.twilight.lightColors.primary);
  });
});

describe('derived palette colors', () => {
  // A regressão que originou isto: a barra lateral usava `onPrimary` como texto sobre
  // `primaryVariant` como fundo, e nas paletas do app esses dois tokens não são um par.
  it.each(PALETTE_NAMES.filter((name) => name !== 'default'))(
    'keeps the %s sidebar readable in both modes',
    (palette) => {
      for (const mode of ['light', 'dark'] as const) {
        applyPalette(palette, mode);

        const background = cssVar('--color-sidebar-bg');
        const text = cssVar('--color-sidebar-text');
        const muted = cssVar('--color-sidebar-muted');

        expect(luminanceGap(background, text)).toBeGreaterThan(0.4);
        expect(luminanceGap(background, muted)).toBeGreaterThan(0.15);
      }
    },
  );

  it.each(PALETTE_NAMES.filter((name) => name !== 'default'))(
    'keeps %s primary buttons readable in both modes',
    (palette) => {
      for (const mode of ['light', 'dark'] as const) {
        applyPalette(palette, mode);
        expect(
          luminanceGap(cssVar('--color-primary'), cssVar('--color-on-primary')),
        ).toBeGreaterThan(0.4);
      }
    },
  );

  it('derives the sidebar hover from the sidebar itself, not a fixed color', () => {
    applyPalette('forest', 'light');
    const forestHover = cssVar('--color-sidebar-hover');

    applyPalette('crimsonSunset', 'light');
    expect(cssVar('--color-sidebar-hover')).not.toBe(forestHover);
  });

  it('emits every derived variable as a usable color', () => {
    applyPalette('ocean', 'dark');
    for (const name of [
      '--color-sidebar-bg',
      '--color-sidebar-text',
      '--color-sidebar-muted',
      '--color-sidebar-hover',
      '--color-on-primary',
      '--color-row-hover',
      '--color-table-head',
      '--color-pre-bg',
    ]) {
      expect(cssVar(name)).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });
});
