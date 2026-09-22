/** @jest-environment node */
import en from '../../src/locales/en.json';
import pt from '../../src/locales/pt.json';

const KEYS = [
  'export_manuscript_format_html',
  'publish_manuscript_attach',
  'publish_manuscript_format',
  'publish_manuscript_include_loose',
  'publish_manuscript_no_routes',
  'publish_manuscript_route',
] as const;

describe('publish manuscript locale keys', () => {
  it.each(KEYS)('defines %s in English and Portuguese', (key) => {
    expect(en[key]).toBeTruthy();
    expect(pt[key]).toBeTruthy();
  });

  it('interpolates the loose count in both languages', () => {
    expect(en.publish_manuscript_include_loose).toContain('{{count}}');
    expect(pt.publish_manuscript_include_loose).toContain('{{count}}');
  });
});
