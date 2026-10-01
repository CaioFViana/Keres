import { MANUSCRIPT_PRESETS, ManuscriptStyleSchema } from '@keres/shared';
import {
  applyPreset,
  defaultExportSettings,
  styleForExport,
  withChange,
} from '../../../src/components/features/manuscript/export/manuscriptExportSettings';

const LINES = { byLine: 'by <$author>', copyright: '© <$year> <$author>' };
const NOW = new Date('2026-09-27T12:00:00.000Z');

describe('manuscriptExportSettings', () => {
  it('keeps the content scope across presets', () => {
    const scoped = withChange(defaultExportSettings('Ana'), {
      arcId: 'arc-2',
      includeLooseScenes: true,
    });
    for (const preset of MANUSCRIPT_PRESETS) {
      expect(applyPreset(scoped, preset)).toMatchObject({
        preset,
        arcId: 'arc-2',
        includeLooseScenes: true,
        author: 'Ana',
      });
    }
  });

  it('marks a change custom and merges style patches', () => {
    const ebook = applyPreset(defaultExportSettings(), 'ebook');
    const changed = withChange(ebook, { style: { quotes: 'guillemets' } });
    expect(changed.preset).toBe('custom');
    expect(changed.style).toEqual({ ...ebook.style, quotes: 'guillemets' });
    // The preset's own style object is never shared or mutated.
    expect(ebook.style.quotes).not.toBe('guillemets');
  });

  it('drops the layout a format cannot honor', () => {
    const settings = withChange(defaultExportSettings(), {
      format: 'md',
      style: { fontFamily: 'sans', fontSize: 12, pageSize: '6x9', quotes: 'curly' },
    });
    const style = styleForExport(settings, LINES, NOW);
    expect(style.fontFamily).toBeUndefined();
    expect(style.fontSize).toBeUndefined();
    expect(style.pageSize).toBeUndefined();
    expect(style.quotes).toBe('curly');
  });

  it('adds the title page only with an author', () => {
    const withPage = withChange(defaultExportSettings('  '), { titlePage: true });
    expect(styleForExport(withPage, LINES, NOW).frontMatter).toBeUndefined();

    const style = styleForExport({ ...withPage, author: ' Ana ' }, LINES, NOW);
    expect(style.frontMatter).toEqual([LINES.byLine, LINES.copyright]);
    expect(style.placeholders).toEqual({ author: 'Ana', year: '2026', date: '2026-09-27' });
  });

  it('builds styles the server schema accepts for every preset and format', () => {
    for (const preset of MANUSCRIPT_PRESETS) {
      const settings = { ...applyPreset(defaultExportSettings('Ana'), preset), titlePage: true };
      expect(ManuscriptStyleSchema.safeParse(styleForExport(settings, LINES, NOW)).success).toBe(
        true,
      );
    }
  });
});
