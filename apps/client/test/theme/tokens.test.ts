import { layout } from '../../src/theme/layout';
import { fontSize, fontWeight, radius, space, type } from '../../src/theme/tokens';

const ascending = (values: number[]) => values.every((v, i) => i === 0 || v > values[i - 1]);

describe('theme tokens', () => {
  it('keeps every scale strictly increasing, so a step always means bigger', () => {
    expect(ascending(Object.values(space))).toBe(true);
    expect(ascending(Object.values(radius))).toBe(true);
    expect(ascending(Object.values(fontSize))).toBe(true);
  });

  it('names one weight per step, with no second spelling of bold', () => {
    expect(Object.values(fontWeight)).toEqual(['400', '500', '600', '700']);
  });

  it('builds the text styles from the scales, without a colour', () => {
    expect(type.title).toEqual({ fontSize: fontSize.xl, fontWeight: fontWeight.bold });
    for (const style of Object.values(type)) {
      expect(style).not.toHaveProperty('color');
    }
  });

  it('shares the layouts every screen repeats', () => {
    expect(layout.row).toEqual({ flexDirection: 'row', alignItems: 'center' });
    expect(layout.fill).toEqual({ flexGrow: 1, flexShrink: 1 });
  });
});
