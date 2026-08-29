/**
 * @jest-environment node
 */
import {
  interpolateColor,
  parseHexColor,
  pointOnCircleBoundary,
} from '../../src/utils/locationMapColors';

it('parses #RGB and #RRGGBB colours', () => {
  expect(parseHexColor('#8BC34A')).toEqual({ r: 139, g: 195, b: 74 });
  expect(parseHexColor('#abc')).toEqual({ r: 170, g: 187, b: 204 });
  expect(parseHexColor('not-a-colour')).toBeNull();
});

it('interpolates two colours halfway', () => {
  expect(interpolateColor('#8BC34A', '#F44336')).toBe('#c08340');
});

it('falls back to grey when a colour cannot be parsed', () => {
  expect(interpolateColor('nope', '#F44336')).toBe('#9E9E9E');
});

it('finds a point on the circle border towards another point', () => {
  const center = { x: 100, y: 100 };
  const towards = { x: 200, y: 100 };
  const point = pointOnCircleBoundary(center, towards, 22);

  expect(point).toEqual({ x: 122, y: 100 });
});
