/** @jest-environment node */
import en from '../../src/locales/en.json';
import pt from '../../src/locales/pt.json';

const KEYS = [
  'export_manuscript_format_html',
  'publish_manuscript_attach',
  'export_manuscript_end_of_excerpt',
  'export_manuscript_choose_start',
  'export_manuscript_begin_at',
  'export_manuscript_scene_order',
  'export_manuscript_scene_order_discovery',
  'export_manuscript_scene_order_shuffled',
  'export_manuscript_scene_order_hint',
] as const;

describe('publish manuscript locale keys', () => {
  it.each(KEYS)('defines %s in English and Portuguese', (key) => {
    expect(en[key]).toBeTruthy();
    expect(pt[key]).toBeTruthy();
  });

  it('interpolates the loose count in both languages', () => {
    expect(en.export_manuscript_include_loose).toContain('{{count}}');
    expect(pt.export_manuscript_include_loose).toContain('{{count}}');
  });
});
