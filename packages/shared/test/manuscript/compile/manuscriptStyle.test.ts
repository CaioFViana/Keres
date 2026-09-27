import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  compileLinearManuscript,
  type CompiledManuscript,
} from '../../../manuscript/compile/export/manuscriptCompiler';
import { buildManuscriptDocxBytes } from '../../../manuscript/compile/export/manuscriptDocx';
import { buildManuscriptHtml } from '../../../manuscript/compile/export/manuscriptHtml';
import { buildManuscriptPdf } from '../../../manuscript/compile/export/manuscriptPdf';
import {
  buildManuscriptMarkdown,
  buildManuscriptText,
} from '../../../manuscript/compile/export/manuscriptText';
import {
  MANUSCRIPT_PRESET_SETTINGS,
  ManuscriptStyleSchema,
  numberInWords,
  presentManuscript,
  renderOptionsOf,
  romanNumeral,
  sceneSeparatorText,
} from '../../../manuscript/compile/manuscriptStyle';

const labels = { goToPage: 'Go to page', goToScene: 'See', tocHeading: 'Contents' };

const compile = (sceneSeparator: string | null = null) =>
  compileLinearManuscript({
    title: 'My Story',
    chapters: [
      { id: 'ch-1', name: 'Arrival', index: 1, type: 'chapter' },
      { id: 'ch-2', name: 'Departure', index: 2, type: 'chapter' },
    ],
    scenes: [
      {
        id: 's-1',
        chapterId: 'ch-1',
        name: 'One',
        index: 1,
        body: 'He said "hi"  there.',
        isDeleted: false,
      },
      {
        id: 's-2',
        chapterId: 'ch-1',
        name: 'Two',
        index: 2,
        body: "It's <$author>'s.",
        isDeleted: false,
      },
      { id: 's-3', chapterId: 'ch-2', name: 'Three', index: 1, body: 'Far.', isDeleted: false },
    ],
    choices: [],
    includeLooseScenes: false,
    looseHeadingLabel: 'Appendix',
    sceneSeparator,
  });

const paragraphTexts = (manuscript: CompiledManuscript) =>
  manuscript.blocks.flatMap((block) =>
    block.kind === 'paragraph' ? [block.spans.map((span) => span.text).join('')] : [],
  );

describe('numbers', () => {
  it('writes roman numerals and spelled-out numbers in English and Portuguese', () => {
    expect([1, 4, 9, 14, 40, 1999].map(romanNumeral)).toEqual([
      'I',
      'IV',
      'IX',
      'XIV',
      'XL',
      'MCMXCIX',
    ]);
    expect([1, 13, 21, 40, 99, 100, 101].map((value) => numberInWords(value, 'en'))).toEqual([
      'One',
      'Thirteen',
      'Twenty-One',
      'Forty',
      'Ninety-Nine',
      'One Hundred',
      '101',
    ]);
    expect([1, 16, 21, 100].map((value) => numberInWords(value, 'pt'))).toEqual([
      'Um',
      'Dezesseis',
      'Vinte e um',
      'Cem',
    ]);
  });
});

describe('presentManuscript', () => {
  it('changes nothing without a style', () => {
    const manuscript = compile();
    expect(presentManuscript(manuscript)).toEqual(manuscript);
  });

  it('numbers chapters in roman, in words, or not at all', () => {
    const chapterNames = (style: Parameters<typeof presentManuscript>[1], language?: 'en' | 'pt') =>
      presentManuscript(compile(), style, language).blocks.flatMap((block) =>
        block.kind === 'chapter' ? [[block.number, block.name]] : [],
      );
    expect(chapterNames({ chapterNumbering: 'roman' })).toEqual([
      [null, 'I. Arrival'],
      [null, 'II. Departure'],
    ]);
    expect(chapterNames({ chapterNumbering: 'words' }, 'pt')).toEqual([
      [null, 'Um. Arrival'],
      [null, 'Dois. Departure'],
    ]);
    expect(chapterNames({ chapterNumbering: 'none' })).toEqual([
      [null, 'Arrival'],
      [null, 'Departure'],
    ]);
  });

  it('curls quotes, keeps apostrophes, collapses spaces and fills placeholders', () => {
    const presented = presentManuscript(compile(), {
      quotes: 'curly',
      collapseSpaces: true,
      placeholders: { author: 'Ana' },
    });
    expect(paragraphTexts(presented)).toEqual(['He said “hi” there.', 'It’s Ana’s.', 'Far.']);
    expect(paragraphTexts(presentManuscript(compile(), { quotes: 'guillemets' }))[0]).toBe(
      'He said «hi»  there.',
    );
  });

  it('sets the title page lines under the title', () => {
    const presented = presentManuscript(compile(), {
      frontMatter: ['by <$author>', '', '© 2026 <$author>'],
      placeholders: { author: 'Ana' },
    });
    expect(presented.blocks.slice(0, 3)).toEqual([
      { kind: 'title', text: 'My Story' },
      { kind: 'subtitle', text: 'by Ana' },
      { kind: 'subtitle', text: '© 2026 Ana' },
    ]);
  });
});

describe('scene separators', () => {
  it('fall between scenes of one chapter, never before a chapter first scene', () => {
    const kinds = compile(sceneSeparatorText({ sceneSeparator: 'hash' })).blocks.map((block) =>
      block.kind === 'scene-break' ? `break:${block.text}` : block.kind,
    );
    expect(kinds).toEqual([
      'title',
      'chapter',
      'scene-heading',
      'paragraph',
      'break:#',
      'scene-heading',
      'paragraph',
      'chapter',
      'scene-heading',
      'paragraph',
    ]);
    expect(sceneSeparatorText({})).toBeNull();
    expect(sceneSeparatorText({ sceneSeparator: 'asterisks' })).toBe('* * *');
  });

  it('are drawn by every renderer', async () => {
    const manuscript = compile('* * *');
    expect(buildManuscriptHtml(manuscript, labels)).toContain('<p class="scene-break">* * *</p>');
    expect(buildManuscriptMarkdown(manuscript, labels)).toContain('\n* * *\n');
    expect(buildManuscriptText(manuscript, labels)).toContain('\n* * *\n');
    const hashed = compile('#');
    expect(buildManuscriptMarkdown(hashed, labels)).toContain('\n\\#\n');
    const pdf = Buffer.from(buildManuscriptPdf(manuscript, labels)).toString('latin1');
    // The PDF draws each word on its own: three asterisks, centered.
    expect(pdf.match(/\(\*\) Tj/g)).toHaveLength(3);
    const docx = await buildManuscriptDocxBytes(manuscript, labels);
    expect(docx.length).toBeGreaterThan(0);
  });
});

describe('typography', () => {
  it('turns a style into renderer flags, leaving out what it does not set', () => {
    expect(renderOptionsOf({}, false)).toEqual({});
    expect(
      renderOptionsOf(
        { fontSize: 12, pageSize: '6x9', quotes: 'curly', paragraphStyle: 'block' },
        true,
      ),
    ).toEqual({ includeToc: true, fontSize: 12, pageSize: '6x9', paragraphStyle: 'block' });
  });

  it('sets the PDF on a 6x9 page when asked, A4 otherwise', () => {
    const a4 = Buffer.from(buildManuscriptPdf(compile(), labels)).toString('latin1');
    const trade = Buffer.from(buildManuscriptPdf(compile(), labels, { pageSize: '6x9' })).toString(
      'latin1',
    );
    expect(a4).toContain('/MediaBox [0 0 595.28 841.89]');
    expect(trade).toContain('/MediaBox [0 0 432 648]');
  });

  it('adds CSS only for what was asked', () => {
    const plain = buildManuscriptHtml(compile(), labels);
    const styled = buildManuscriptHtml(compile(), labels, {
      fontFamily: 'sans',
      fontSize: 12,
      lineSpacing: 2,
      paragraphStyle: 'block',
    });
    expect(plain).not.toContain('font-size: 12pt');
    expect(styled).toContain(
      "body { font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 12pt; line-height: 2; }",
    );
    expect(styled).toContain('p { text-indent: 0; margin: 0 0 1em; }');
  });

  it('every preset is a valid style', () => {
    for (const settings of Object.values(MANUSCRIPT_PRESET_SETTINGS)) {
      expect(ManuscriptStyleSchema.parse(settings.style)).toEqual(settings.style);
    }
  });
});

/**
 * Byte stability: without options, every renderer draws exactly what it drew before the style
 * options existed. The digests pin today's output; a change here is a change every exported and
 * published manuscript sees.
 */
describe('byte stability without options', () => {
  const digest = (content: string | Uint8Array) =>
    createHash('sha256').update(content).digest('hex').slice(0, 16);

  it('keeps the text formats and the PDF unchanged', () => {
    const manuscript = compile();
    expect({
      html: digest(buildManuscriptHtml(manuscript, labels)),
      md: digest(buildManuscriptMarkdown(manuscript, labels)),
      txt: digest(buildManuscriptText(manuscript, labels)),
      pdf: digest(buildManuscriptPdf(manuscript, labels)),
    }).toMatchSnapshot();
  });
});
