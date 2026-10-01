/**
 * @jest-environment node
 */
import { renderMapIconSvg } from '../../src/utils/mapIconSvg';

it('draws a plain icon with a fill and transform on every shape', () => {
  const shapes = renderMapIconSvg('pin', 100, 100, '#8BC34A');

  expect(shapes).toContain('<path');
  expect(shapes).toContain('fill="#8BC34A"');
  expect(shapes).toContain('transform="translate(84 84) scale(0.0625)"');
});

it('resolves the explicit ion: namespace to the same shapes', () => {
  expect(renderMapIconSvg('ion:pin', 100, 100, '#8BC34A')).toBe(
    renderMapIconSvg('pin', 100, 100, '#8BC34A'),
  );
});

it('falls back to the solid name for older outline picks', () => {
  const shapes = renderMapIconSvg('pin-outline', 100, 100, '#8BC34A');

  expect(shapes).toContain('<path');
});

it('draws keres pack icons from the vendored silhouettes', () => {
  const shapes = renderMapIconSvg('keres:castle', 100, 100, '#8BC34A');

  expect(shapes).toContain('<path');
  expect(shapes).toContain('fill="#8BC34A"');
  expect(shapes).toContain('transform="translate(84 84) scale(0.0625)"');
  expect(renderMapIconSvg('keres:nope', 100, 100, '#8BC34A')).toBe('');
});

it('renders nothing for foreign and empty names', () => {
  expect(renderMapIconSvg('fa:flag', 100, 100, '#8BC34A')).toBe('');
  expect(renderMapIconSvg('', 100, 100, '#8BC34A')).toBe('');
  expect(renderMapIconSvg('no-such-icon', 100, 100, '#8BC34A')).toBe('');
});

it('scales the icon to the requested pixel size', () => {
  const shapes = renderMapIconSvg('pin', 100, 100, '#8BC34A', 20);

  expect(shapes).toContain('transform="translate(90 90) scale(0.0390625)"');
});
