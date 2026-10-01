import { KERES_ICON_PATHS } from '../../src/utils/keresIconPaths';
import { buildKeresSvgMarkup, keresIconDataUri } from '../../src/utils/keresIconMarkup';

const shapes = KERES_ICON_PATHS['castle'];

it('builds standalone tinted svg markup on the pack viewBox', () => {
  const markup = buildKeresSvgMarkup(shapes, '#123456');

  expect(markup.startsWith('<svg xmlns="http://www.w3.org/2000/svg"')).toBe(true);
  expect(markup).toContain('viewBox="0 0 512 512"');
  expect(markup).toContain('<path');
  expect(markup).toContain('fill="#123456"');
  expect(markup.endsWith('</svg>')).toBe(true);
});

it('wraps the markup in a decodable data URI', () => {
  const uri = keresIconDataUri(shapes, '#123456');

  expect(uri.startsWith('data:image/svg+xml;charset=utf-8,')).toBe(true);
  expect(decodeURIComponent(uri.slice(uri.indexOf(',') + 1))).toBe(
    buildKeresSvgMarkup(shapes, '#123456'),
  );
});
