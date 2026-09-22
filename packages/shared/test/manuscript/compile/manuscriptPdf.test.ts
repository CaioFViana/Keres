import { describe, expect, it } from 'vitest';
import type {
  CompiledBlock,
  CompiledManuscript,
} from '../../../manuscript/compile/export/manuscriptCompiler';
import { buildManuscriptPdf } from '../../../manuscript/compile/export/manuscriptPdf';
import { TIMES_WIDTHS } from '../../../manuscript/compile/export/timesWidths';

const LABELS = { goToPage: 'Go to page', tocHeading: 'Contents' };

function paragraph(text: string): CompiledBlock {
  return {
    kind: 'paragraph',
    spans: [{ text, bold: false, italic: false, underline: false, strikethrough: false }],
  };
}

function manuscript(blocks: CompiledBlock[]): CompiledManuscript {
  return { title: 'My Story', blocks };
}

function raw(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('latin1');
}

/** Every word the renderer shows, in draw order. */
function shownText(bytes: Uint8Array): string {
  const shown: string[] = [];
  const textPattern = /\((?:\\.|[^\\()])*\) Tj/g;
  let text: RegExpExecArray | null;
  const content = raw(bytes);
  while ((text = textPattern.exec(content)) !== null) {
    shown.push(text[0].replace(/^\(|\) Tj$/g, '').replace(/\\(.)/g, '$1'));
  }
  return shown.join(' ');
}

/** The cross-reference table is honest: every offset lands on its object. */
function expectSoundXref(bytes: Uint8Array): void {
  const text = raw(bytes);
  const table = text.slice(text.indexOf('xref\n'));
  const lines = table.split('\n');
  expect(lines[1]).toMatch(/^0 \d+$/);
  const count = Number(lines[1].split(' ')[1]);
  for (let id = 1; id < count; id += 1) {
    const offset = Number(lines[2 + id].slice(0, 10));
    expect(text.slice(offset, offset + `${id} 0 obj`.length)).toBe(`${id} 0 obj`);
  }
  const startxref = Number(text.slice(text.lastIndexOf('startxref\n') + 10).split('\n')[0]);
  expect(text.slice(startxref, startxref + 4)).toBe('xref');
}

describe('buildManuscriptPdf', () => {
  it('produces a sound single page carrying the title', () => {
    const bytes = buildManuscriptPdf(
      manuscript([{ kind: 'title', text: 'My Story' }, paragraph('Once upon a time.')]),
      LABELS,
    );

    expect(bytes.slice(0, 5)).toEqual(new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]));
    expectSoundXref(bytes);
    expect(raw(bytes)).toContain('/Count 1');
    expect(raw(bytes)).toContain('/Title <FEFF004D0079002000530074006F00720079>');
    expect(shownText(bytes)).toContain('My Story');
    expect(shownText(bytes)).toContain('Once upon a time.');
  });

  it('opens a new page per chapter, except the first', () => {
    const bytes = buildManuscriptPdf(
      manuscript([
        { kind: 'title', text: 'My Story' },
        { kind: 'chapter', id: 'c-1', number: 1, name: 'First', bookmarkId: 'chapter-c1' },
        paragraph('Alpha.'),
        { kind: 'chapter', id: 'c-2', number: 2, name: 'Second', bookmarkId: 'chapter-c2' },
        paragraph('Beta.'),
      ]),
      LABELS,
    );

    expectSoundXref(bytes);
    expect(raw(bytes)).toContain('/Count 2');
  });

  it('flows long bodies across pages', () => {
    const blocks: CompiledBlock[] = [{ kind: 'title', text: 'My Story' }];
    for (let index = 0; index < 120; index += 1) {
      blocks.push(paragraph(`Paragraph ${index} fills the page with patient words.`));
    }

    const text = raw(buildManuscriptPdf(manuscript(blocks), LABELS));

    expect(text).toMatch(/\/Count ([3-9]\d*)/);
  });

  it('resolves choice references to the target real page', () => {
    const text = shownText(
      buildManuscriptPdf(
        manuscript([
          { kind: 'title', text: 'My Story' },
          { kind: 'chapter', id: 'c-1', number: 1, name: 'First', bookmarkId: 'chapter-c1' },
          {
            kind: 'scene-heading',
            id: 's-1',
            number: 1,
            name: 'Opening',
            bookmarkId: 'scene-s-1',
          },
          {
            kind: 'choice',
            id: 'ch-1',
            text: 'Go on',
            targetSceneId: 's-2',
            targetBookmarkId: 'scene-s-2',
            targetSceneName: 'Far Away',
          },
          { kind: 'chapter', id: 'c-2', number: 2, name: 'Second', bookmarkId: 'chapter-c2' },
          {
            kind: 'scene-heading',
            id: 's-2',
            number: 2,
            name: 'Far Away',
            bookmarkId: 'scene-s-2',
          },
          paragraph('Arrived.'),
        ]),
        LABELS,
      ),
    );

    expect(text).toContain('Go to page 2');
  });

  it('falls back to the scene name when the anchor left the export', () => {
    const text = shownText(
      buildManuscriptPdf(
        manuscript([
          { kind: 'title', text: 'My Story' },
          {
            kind: 'choice',
            id: 'ch-1',
            text: 'Go on',
            targetSceneId: 's-2',
            targetBookmarkId: 'scene-s-2',
            targetSceneName: 'Far Away',
          },
        ]),
        LABELS,
      ),
    );

    expect(text).toContain('Far Away');
    expect(text).not.toContain('Go to page');
  });

  it('declares WinAnsiEncoding on every font so Latin punctuation renders', () => {
    const text = raw(buildManuscriptPdf(manuscript([paragraph('Hi.')]), LABELS));

    expect(text.match(/\/Encoding \/WinAnsiEncoding/g)).toHaveLength(4);
  });

  it('encodes Portuguese punctuation as WinAnsi bytes', () => {
    const text = shownText(
      buildManuscriptPdf(manuscript([paragraph('“Olá” — «mundo»…')]), LABELS),
    );

    const byte = (code: number) => String.fromCharCode(code);
    expect(text).toContain(byte(0x93));
    expect(text).toContain(byte(0xe1));
    expect(text).toContain(byte(0x97));
    expect(text).toContain(byte(0xab));
    expect(text).toContain(byte(0x85));
  });

  it('drops zero-width characters and splits on unicode spaces', () => {
    const zeroWidthSpace = String.fromCharCode(0x200b);
    const zeroWidthJoiner = String.fromCharCode(0x200d);
    const emSpace = String.fromCharCode(0x2003);
    const text = shownText(
      buildManuscriptPdf(
        manuscript([paragraph(`a${zeroWidthSpace}${zeroWidthJoiner}b${emSpace}c`)]),
        LABELS,
      ),
    );

    expect(text).toContain('ab');
    expect(text).toContain('c');
    expect(text).not.toContain('?');
  });

  it('stores the title as UTF-16BE so metadata keeps every character', () => {
    const bytes = buildManuscriptPdf(
      { title: 'João “Olá”', blocks: [paragraph('Hi.')] },
      LABELS,
    );

    expectSoundXref(bytes);
    expect(raw(bytes)).toContain('00E3006F0020201C004F006C00E1201D');
  });

  it('trims phantom lines from empty headings', () => {
    const text = raw(
      buildManuscriptPdf(
        { title: '', blocks: [{ kind: 'title', text: '' }, paragraph('First line.') ] },
        LABELS,
      ),
    );

    // The first drawn line sits at the very top: no 29pt hole from the empty title.
    expect(text.match(/1 0 0 1 (\S+) (\S+) Tm/)?.[2]).toBe('774.19');
  });

  it('trims paragraphs that degrade to nothing', () => {
    const text = raw(
      buildManuscriptPdf(
        manuscript([paragraph(String.fromCharCode(0x200b)), paragraph('Visible.')]),
        LABELS,
      ),
    );

    expect(text.match(/1 0 0 1 (\S+) (\S+) Tm/)?.[2]).toBe('774.19');
  });

  it('sets the manuscript in Times, like the HTML export', () => {
    const text = raw(buildManuscriptPdf(manuscript([paragraph('Hi.')]), LABELS));

    expect(text).toContain('/BaseFont /Times-Roman');
    expect(text).not.toContain('Courier');
  });

  it('lays out proportionally: narrow words start further right when centered', () => {
    const xOf = (title: string): number => {
      const text = raw(buildManuscriptPdf(manuscript([{ kind: 'title', text: title }]), LABELS));
      return Number(text.match(/1 0 0 1 (\S+) \S+ Tm/)?.[1]);
    };

    expect(xOf('iii')).toBeGreaterThan(xOf('MMM'));
  });

  it('carries honest Times widths', () => {
    expect(TIMES_WIDTHS['times'][32]).toBe(250);
    expect(TIMES_WIDTHS['times'][65]).toBe(722);
    expect(TIMES_WIDTHS['times'][97]).toBe(444);
    expect(TIMES_WIDTHS['times'][63]).toBe(444);
    expect(TIMES_WIDTHS['times'][0x97]).toBe(1000);
    expect(TIMES_WIDTHS['times-bold'][65]).toBe(722);
    expect(TIMES_WIDTHS['times-italic'][65]).toBe(611);
    expect(TIMES_WIDTHS['times-bolditalic'][65]).toBe(667);
  });

  it('degrades control characters instead of emitting raw bytes', () => {
    const text = shownText(
      buildManuscriptPdf(manuscript([paragraph('a\x01\x7Fb')]), LABELS),
    );

    expect(text).toContain('a??b');
  });

  it('renders a clickable index when enabled', () => {
    const manuscript: CompiledManuscript = {
      title: 'My Story',
      blocks: [
        { kind: 'title', text: 'My Story' },
        { kind: 'chapter', id: 'ch-1', number: 1, name: 'Arrival', bookmarkId: 'chapter-ch1' },
        { kind: 'scene-heading', id: 's-1', number: 1, name: 'Opening', bookmarkId: 'scene-s1' },
        paragraph('First.'),
        { kind: 'chapter', id: 'ch-2', number: 2, name: 'Later', bookmarkId: 'chapter-ch2' },
        paragraph('Second.'),
      ],
    };
    const bytes = buildManuscriptPdf(manuscript, LABELS, { includeToc: true });

    expectSoundXref(bytes);
    const text = shownText(bytes);
    expect(text).toContain('Contents');
    expect(text).toContain('1. Arrival');
    expect(text).toContain('1. Opening');
    expect(text).toContain('2. Later');
    expect(text).toMatch(/Arrival \.+ 2/);
    expect(text).toMatch(/Opening \.+ 2/);
    expect(text).toMatch(/Later \.+ 3/);
    expect(raw(bytes).match(/\/Subtype \/Link/g)).toHaveLength(3);
    expect(raw(bytes).match(/\/Dest \[\d+ 0 R \/XYZ null [\d.]+ null\]/g)).toHaveLength(3);
    expect(raw(bytes)).toContain('/Rect [56.7 ');
  });

  it('keeps the title and index on their own page', () => {
    const manuscript: CompiledManuscript = {
      title: 'My Story',
      blocks: [
        { kind: 'title', text: 'My Story' },
        { kind: 'chapter', id: 'ch-1', number: 1, name: 'Arrival', bookmarkId: 'chapter-ch1' },
        paragraph('First.'),
        { kind: 'chapter', id: 'ch-2', number: 2, name: 'Later', bookmarkId: 'chapter-ch2' },
        paragraph('Second.'),
      ],
    };

    expect(raw(buildManuscriptPdf(manuscript, LABELS))).toContain('/Count 2');
    expect(raw(buildManuscriptPdf(manuscript, LABELS, { includeToc: true }))).toContain('/Count 3');
  });

  it('breaks before scene-first bodies too', () => {
    const manuscript: CompiledManuscript = {
      title: 'My Story',
      blocks: [
        { kind: 'title', text: 'My Story' },
        { kind: 'subtitle', text: 'Main' },
        { kind: 'scene-heading', id: 's-1', number: 1, name: 'Opening', bookmarkId: 'scene-s1' },
        paragraph('First.'),
      ],
    };

    expect(raw(buildManuscriptPdf(manuscript, LABELS, { includeToc: true }))).toContain('/Count 2');
  });

  it('rules underlines and strikethroughs, grouped over contiguous words', () => {
    const marked: CompiledManuscript = {
      title: 'My Story',
      blocks: [
        { kind: 'title', text: 'My Story' },
        {
          kind: 'paragraph',
          spans: [
            { text: 'plain ', bold: false, italic: false, underline: false, strikethrough: false },
            { text: 'two words', bold: false, italic: false, underline: true, strikethrough: false },
            { text: ' mid ', bold: false, italic: false, underline: false, strikethrough: false },
            { text: 'gone', bold: false, italic: false, underline: false, strikethrough: true },
          ],
        },
      ],
    };

    // Three marked words, two rules: the contiguous underline shares one.
    expect(raw(buildManuscriptPdf(marked, LABELS)).match(/re f/g)).toHaveLength(2);
    expect(raw(buildManuscriptPdf(manuscript([paragraph('plain')]), LABELS))).not.toContain(
      're f',
    );
  });

  it('omits the index unless enabled', () => {
    const bytes = buildManuscriptPdf(
      manuscript([
        { kind: 'title', text: 'My Story' },
        { kind: 'chapter', id: 'ch-1', number: 1, name: 'Arrival', bookmarkId: 'chapter-ch1' },
        paragraph('First.'),
      ]),
      LABELS,
    );

    expect(shownText(bytes)).not.toContain('Contents');
    expect(raw(bytes)).not.toContain('/Link');
  });

  it('skips the index when there is nothing to list', () => {
    const bytes = buildManuscriptPdf(
      { title: 'Empty', blocks: [{ kind: 'title', text: 'Empty' }] },
      LABELS,
      { includeToc: true },
    );

    expectSoundXref(bytes);
    expect(shownText(bytes)).not.toContain('Contents');
    expect(raw(bytes)).not.toContain('/Link');
  });

  it('degrades unencodable characters instead of breaking the file', () => {
    const bytes = buildManuscriptPdf(
      manuscript([paragraph('Dragon 🐉 rises — “yes”.')]),
      LABELS,
    );

    expectSoundXref(bytes);
    // WinAnsi bytes, read back as Latin-1: 0x97 em dash, 0x93/0x94 quotes.
    const text = shownText(bytes);
    const emDash = String.fromCharCode(0x97);
    const openQuote = String.fromCharCode(0x93);
    const closeQuote = String.fromCharCode(0x94);
    expect(text).toContain('Dragon ? rises');
    expect(text).toContain(emDash);
    expect(text).toContain(`${openQuote}yes${closeQuote}.`);
  });
});
