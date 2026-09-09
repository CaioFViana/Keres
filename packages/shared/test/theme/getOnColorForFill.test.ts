import { describe, expect, it } from 'vitest';
import { getOnColorForFill } from '../../theme/getOnColorForFill';
import { themes } from '../../theme/palettes';
import { getContrastRatio } from '../../utils/colorUtils';

describe('getOnColorForFill', () => {
  it('maps known fills to their on* tokens', () => {
    const colors = themes.seaOfStars!.darkColors;
    expect(getOnColorForFill(colors, colors.primary)).toBe(colors.onPrimary);
    expect(getOnColorForFill(colors, colors.accent)).toBe(colors.onAccent);
    expect(getOnColorForFill(colors, colors.notification)).toBe(colors.onNotification);
    expect(getOnColorForFill(colors, colors.error)).toBe(colors.onError);
    expect(getOnColorForFill(colors, undefined)).toBe(colors.onPrimary);
  });

  it('keeps Sea of Stars dark toolbar icons readable on primary fills', () => {
    const colors = themes.seaOfStars!.darkColors;
    const onPrimary = getOnColorForFill(colors, colors.primary);
    expect(getContrastRatio(colors.primary, onPrimary)!).toBeGreaterThanOrEqual(4.5);
    expect(getContrastRatio(colors.primary, colors.text)!).toBeLessThan(3);
  });
});
