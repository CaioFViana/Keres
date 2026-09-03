import { describe, expect, it } from 'vitest';
import {
  ENTITY_APPEARANCE,
  WORLD_PIECE_SECTION_APPEARANCE,
  getContrastRatio,
  getContrastTextColor,
} from '../../index';

describe('entity appearance palettes', () => {
  it('gives Story a distinct icon instead of the generic fallback', () => {
    expect(ENTITY_APPEARANCE.Story.icon).toBe('book');
  });

  it('keeps every theme variant readable with its chosen black or white foreground', () => {
    const colors = [
      ...Object.values(ENTITY_APPEARANCE).flatMap(({ light, dark }) => [light, dark]),
      ...Object.values(WORLD_PIECE_SECTION_APPEARANCE).flatMap(({ light, dark }) => [light, dark]),
    ];

    for (const color of colors) {
      const foreground = getContrastTextColor(color) === 'black' ? '#000000' : '#FFFFFF';
      expect(getContrastRatio(color, foreground), color).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('uses dark text for the lighter dark-theme tile variants', () => {
    for (const entityType of ['Scene', 'Item', 'StorySchemaField'] as const) {
      expect(getContrastTextColor(ENTITY_APPEARANCE[entityType].dark)).toBe('black');
    }
  });
});
