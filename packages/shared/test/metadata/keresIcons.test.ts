import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  KERES_ICON_CATEGORIES,
  KERES_ICON_OPTIONS,
  KERES_ICONS,
  type KeresIconCategory,
} from '../../metadata/keresIcons';

const SVG_DIR = join(__dirname, '..', '..', 'metadata', 'keres');

describe('keresIcons manifest', () => {
  it('lists unique kebab-case names in known categories', () => {
    const names = KERES_ICONS.map((entry) => entry.name);
    expect(new Set(names).size).toBe(names.length);
    expect(KERES_ICON_OPTIONS).toEqual(names);
    for (const entry of KERES_ICONS) {
      expect(entry.name).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
      expect(KERES_ICON_CATEGORIES).toContain(entry.category);
      expect(entry.author.length).toBeGreaterThan(0);
      expect(entry.keywords.length).toBeGreaterThan(0);
    }
    const used = new Set<KeresIconCategory>(KERES_ICONS.map((entry) => entry.category));
    expect([...used].sort()).toEqual([...KERES_ICON_CATEGORIES].sort());
  });

  it('vendors one 512 viewBox badge-free SVG per entry', () => {
    expect(KERES_ICONS.length).toBeGreaterThan(0);
    for (const entry of KERES_ICONS) {
      const svg = readFileSync(join(SVG_DIR, `${entry.name}.svg`), 'utf8');
      expect(svg).toContain('viewBox="0 0 512 512"');
      expect(svg).not.toMatch(/<(g|mask|filter)[\s>]/);
      expect(svg).not.toContain('transform=');
      expect(existsSync(join(SVG_DIR, 'NOTICE.md'))).toBe(true);
    }
  });
});
