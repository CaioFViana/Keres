import { describe, expect, it } from 'vitest';
import {
  interpolateColor,
  parseHexColor,
  pointOnCircleBoundary,
} from '../../graphs/locationMapGeometry';

describe('location map geometry', () => {
  it('parses colours and interpolates pin colours', () => {
    expect(parseHexColor('#8BC34A')).toEqual({ r: 139, g: 195, b: 74 });
    expect(parseHexColor('#abc')).toEqual({ r: 170, g: 187, b: 204 });
    expect(parseHexColor('not-a-colour')).toBeNull();
    expect(interpolateColor('#8BC34A', '#F44336')).toBe('#c08340');
    expect(interpolateColor('nope', '#F44336')).toBe('#9E9E9E');
  });
  it('keeps relation lines outside a pin', () => {
    expect(pointOnCircleBoundary({ x: 0, y: 0 }, { x: 10, y: 0 }, 4)).toEqual({ x: 4, y: 0 });
  });
});
