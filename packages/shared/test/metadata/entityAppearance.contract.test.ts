import { describe, expect, it } from 'vitest';
import {
  getEntityAppearance,
  getWorldPieceSectionAppearance,
  setEntityAppearanceScheme,
} from '../../metadata/entityAppearance';

describe('entity appearance palette', () => {
  it('resolves explicit, host-default, and fallback entity colors', () => {
    setEntityAppearanceScheme(false);
    expect(getEntityAppearance('Character')).toEqual({
      icon: 'people',
      color: '#00897B',
    });
    expect(getEntityAppearance('Character', true)).toEqual({
      icon: 'people',
      color: '#37AFA5',
    });
    setEntityAppearanceScheme(true);
    expect(getEntityAppearance('Character')).toEqual({
      icon: 'people',
      color: '#37AFA5',
    });
    expect(getEntityAppearance('Unknown')).toEqual({
      icon: 'ellipse',
      color: '#607D8B',
    });
  });

  it('uses the same active or explicit scheme for world-piece sections', () => {
    expect(getWorldPieceSectionAppearance('fauna')).toEqual({
      icon: 'paw-outline',
      color: '#EF5350',
    });
    expect(getWorldPieceSectionAppearance('fauna', false)).toEqual({
      icon: 'paw-outline',
      color: '#C62828',
    });
  });
});
