import JSZip from 'jszip';
import { inflate } from 'pako';
import { describe, expect, it } from 'vitest';
import { compileStoryManuscript } from '../../../manuscript/compile/compileStoryManuscript';
import type { ManuscriptOptionsInput } from '../../../manuscript/compile/manuscriptContracts';
import {
  DEFAULT_MANUSCRIPT_LABELS,
  ManuscriptOptionsSchema,
} from '../../../manuscript/compile/manuscriptContracts';
import {
  openingsOf,
  type PageBlock,
} from '../../../manuscript/compile/export/manuscriptPageFigure';
import type {
  ManuscriptChapter,
  ManuscriptPage,
  ManuscriptScene,
} from '../../../manuscript/compile/manuscriptSections';
import {
  presentedManuscriptOf,
  type CompileStoryManuscriptInput,
} from '../../../manuscript/compile/presentedManuscript';
import type { ManuscriptImage } from '../../../manuscript/images/imageInfo';
import { solidPng } from '../images/imageFixtures';

const page = (id: string, mediaId: string | null, text: string | null, extra: object = {}) =>
  ({ id, mediaId, text, fit: 'contain', ...extra }) as ManuscriptPage;

const chapters: ManuscriptChapter[] = [
  { id: 'ch-1', name: 'Issue one', index: 1, type: 'chapter' },
];

const scene = (pages: ManuscriptPage[]): ManuscriptScene => ({
  id: 's1',
  chapterId: 'ch-1',
  name: 's1',
  index: 1,
  body: null,
  isDeleted: false,
  pages,
});

const media: Record<string, ManuscriptImage> = {
  a: solidPng(300, 450, [200, 60, 60, 255]),
  b: solidPng(450, 300, [60, 160, 80, 255]),
  w: solidPng(600, 450, [220, 180, 40, 255]),
};

function input(pages: ManuscriptPage[]): CompileStoryManuscriptInput {
  return {
    storyTitle: 'Comic',
    storyType: 'linear',
    chapters,
    scenes: [scene(pages)],
    choices: [],
    media,
  };
}

const six = [
  page('p1', 'a', 'PANEL 1\nHe looks up.'),
  page('p2', 'a', 'Second.'),
  page('p3', 'a', 'Third.'),
  page('p4', 'w', 'The reveal.', { spread: true }),
  page('p5', 'a', 'Fifth.'),
  page('p6', 'a', null),
];

const compile = (options: ManuscriptOptionsInput, pages = six) =>
  compileStoryManuscript(input(pages), options);
const decode = (bytes: Uint8Array) => new TextDecoder().decode(bytes);
const latin1 = (bytes: Uint8Array) =>
  Array.from(bytes, (byte) => String.fromCharCode(byte)).join('');

/** What each PDF page draws: the words set on it and how many pictures it draws. */
function pdfPages(bytes: Uint8Array): { words: string; pictures: number }[] {
  const text = latin1(bytes);
  const pages: { words: string; pictures: number }[] = [];
  for (const match of text.matchAll(/stream\r?\n/g)) {
    const start = match.index + match[0].length;
    const end = text.indexOf('endstream', start);
    try {
      const raw = latin1(inflate(bytes.subarray(start, end - 1)));
      if (!/ Tf| Do/.test(raw)) continue;
      pages.push({
        words: [...raw.matchAll(/\((.*?)\)\s*Tj/g)].map((entry) => entry[1]).join(' '),
        pictures: (raw.match(/\/Im\d+ Do/g) ?? []).length,
      });
    } catch {
      // A picture's own stream, not a page.
    }
  }
  return pages;
}

const blocksOf = (pages: ManuscriptPage[], options: ManuscriptOptionsInput) =>
  presentedManuscriptOf(
    input(pages),
    ManuscriptOptionsSchema.parse(options),
    DEFAULT_MANUSCRIPT_LABELS,
  );

describe('the pages of a comic in the compiled blocks', () => {
  it('numbers a double-page spread as two pages and keeps each page’s text with it', () => {
    const pages = blocksOf(six, { format: 'html' }).blocks.filter(
      (block): block is PageBlock => block.kind === 'page',
    );

    expect(pages.map((entry) => [entry.label, entry.number, entry.spread])).toEqual([
      ['Page 1', 1, false],
      ['Page 2', 2, false],
      ['Page 3', 3, false],
      ['Page 4–5', 4, true],
      ['Page 6', 6, false],
      ['Page 7', 7, false],
    ]);
    expect(pages[0].text).toEqual(['PANEL 1', 'He looks up.']);
  });

  it('writes the text as paragraphs after the page in a flow, and keeps it in the page in a sheet', () => {
    const kinds = (layout: 'flow' | 'sheet') =>
      blocksOf([page('p1', 'a', 'One.\nTwo.')], { format: 'html', pageLayout: layout }).blocks.map(
        (block) => block.kind,
      );

    expect(kinds('flow')).toEqual(['title', 'chapter', 'page', 'paragraph', 'paragraph']);
    expect(kinds('sheet')).toEqual(['title', 'chapter', 'page']);
  });

  it('keeps Markdown and plain text flowing whatever the layout, since they carry no pictures', () => {
    const blocks = blocksOf([page('p1', 'a', 'One.')], {
      format: 'md',
      pageLayout: 'sheet',
    }).blocks;

    expect(blocks.map((block) => block.kind)).toEqual(['title', 'chapter', 'page', 'paragraph']);
  });
});

describe('openings of a book', () => {
  const pagesOf = (...entries: [number, boolean?][]): PageBlock[] =>
    entries.map(
      ([number, spread]) =>
        ({ kind: 'page', id: `p${number}`, number, spread: spread ?? false }) as PageBlock,
    );
  const shape = (pages: PageBlock[]) =>
    openingsOf(pages).map((opening) =>
      opening.wide
        ? `wide ${opening.wide.number}`
        : `${opening.left?.number ?? '-'}|${opening.right?.number ?? '-'}`,
    );

  it('sets the first page alone on the right and then the pages in pairs, even numbers on the left', () => {
    expect(shape(pagesOf([1], [2], [3], [4], [5], [6]))).toEqual(['-|1', '2|3', '4|5', '6|-']);
  });

  it('gives a double-page spread an opening of its own', () => {
    expect(shape(pagesOf([1], [2], [3], [4, true], [6], [7]))).toEqual([
      '-|1',
      '2|3',
      'wide 4',
      '6|7',
    ]);
  });

  it('leaves a page whose partner is not there with an empty side', () => {
    expect(shape(pagesOf([2], [5]))).toEqual(['2|-', '-|5']);
  });
});

describe('a comic as HTML', () => {
  it('sets a planning sheet: the picture beside its caption and its text', async () => {
    const html = decode((await compile({ format: 'html', pageLayout: 'sheet' })).bytes);

    expect(html).toContain('<figure class="page sheet" style="--art: 38%">');
    expect(html).toContain(
      '<div class="script"><figcaption>Page 1</figcaption><p>PANEL 1</p><p>He looks up.</p></div>',
    );
    expect(html).toContain('figure.page.sheet');
    // The text is in the sheet, not repeated after it.
    expect(html.match(/He looks up\./g)).toHaveLength(1);
  });

  it('gives a frame wider than tall, or a spread, more of the row', async () => {
    const html = decode(
      (
        await compile({ format: 'html', pageLayout: 'sheet' }, [
          page('p1', 'w', 'Wide.', { spread: true }),
        ])
      ).bytes,
    );

    expect(html).toContain('style="--art: 55%"');
  });

  it('sets the pages in pairs, as a printed comic opens, one picture across a double-page spread', async () => {
    const html = decode((await compile({ format: 'html', pageLayout: 'spreads' })).bytes);

    expect(html.match(/<section class="spread">/g)).toHaveLength(4);
    expect(html).toContain('<figure class="page wide">');
    expect(html).toContain('<figcaption>Page 4–5</figcaption>');
    // The first page stands alone on the right: its left side is empty.
    expect(html).toContain(
      '<section class="spread"><div class="blank"></div><figure class="page right">',
    );
    expect(html).toContain('.spread {');
    // Spreads are the pictures: the script stays on the sheet.
    expect(html).not.toContain('He looks up.');
  });

  it('is the long-standing flow when no layout is asked', async () => {
    const html = decode((await compile({ format: 'html' })).bytes);

    expect(html).toContain('<figure class="page"><figcaption>Page 1</figcaption>');
    expect(html).not.toContain('class="spread"');
    expect(html).not.toContain('figure.page.sheet');
  });
});

describe('a comic as an EPUB', () => {
  it('carries the layout in its text files and its stylesheet', async () => {
    const zip = await JSZip.loadAsync(
      (await compile({ format: 'epub', pageLayout: 'spreads' })).bytes,
    );
    const names = Object.keys(zip.files).filter((name) => /^OEBPS\/text-\d+\.xhtml$/.test(name));
    const text = (await Promise.all(names.map((name) => zip.file(name)!.async('string')))).join('');
    const css = await zip.file('OEBPS/style.css')!.async('string');

    expect(text).toContain('<section class="spread">');
    expect(css).toContain('.spread {');
  });
});

describe('a comic as a Word document', () => {
  const documentXml = async (layout: 'flow' | 'sheet' | 'spreads') => {
    const zip = await JSZip.loadAsync(
      (await compile({ format: 'docx', pageLayout: layout })).bytes,
    );
    return zip.file('word/document.xml')!.async('string');
  };

  it('sets each page of a sheet in a row of a table, and a flow with no table at all', async () => {
    expect((await documentXml('sheet')).match(/<w:tbl>/g)).toHaveLength(6);
    expect(await documentXml('flow')).not.toContain('<w:tbl>');
  });

  it('sets an opening in a row, and a double-page spread across both cells', async () => {
    const xml = await documentXml('spreads');

    expect(xml.match(/<w:tbl>/g)).toHaveLength(4);
    expect(xml).toContain('<w:gridSpan w:val="2"/>');
  });
});

describe('a comic as a PDF', () => {
  it('sets two pages of a comic on a sheet, each picture with its text', async () => {
    const flow = pdfPages((await compile({ format: 'pdf', pageLayout: 'flow' })).bytes);
    const sheet = pdfPages((await compile({ format: 'pdf', pageLayout: 'sheet' })).bytes);

    expect(sheet.length).toBeLessThan(flow.length);
    expect(sheet[0].pictures).toBeGreaterThanOrEqual(2);
    expect(sheet[0].words).toContain('Page 1');
    expect(sheet[0].words).toContain('PANEL 1');
    expect(sheet[0].words).toContain('Page 2');
  });

  it('sets the spreads on landscape sheets, an opening to a sheet, pictures and captions only', async () => {
    const { bytes } = await compile({ format: 'pdf', pageLayout: 'spreads' });
    const pages = pdfPages(bytes);

    expect(latin1(bytes)).toContain('/MediaBox [0 0 841.89 595.28]');
    const openings = pages.filter((entry) => entry.pictures > 0);
    expect(openings.map((entry) => entry.pictures)).toEqual([1, 2, 1, 2]);
    expect(openings[1].words).toContain('Page 2');
    expect(openings[1].words).toContain('Page 3');
    // The en dash is one byte in the PDF's own encoding (WinAnsi).
    expect(openings[2].words).toMatch(/Page 4.5/);
    expect(pages.map((entry) => entry.words).join(' ')).not.toContain('He looks up');
  });

  it('carries on a text taller than a sheet in plates of its own, losing nothing', async () => {
    const long = Array.from({ length: 90 }, (_, index) => `Line number ${index + 1} of the script`);
    const pages = pdfPages(
      (await compile({ format: 'pdf', pageLayout: 'sheet' }, [page('p1', 'a', long.join('\n'))]))
        .bytes,
    );
    const all = pages.map((entry) => entry.words).join(' ');

    expect(pages.length).toBeGreaterThan(1);
    expect(pages.filter((entry) => entry.pictures > 0)).toHaveLength(1);
    for (const index of [1, 45, 90]) expect(all).toContain(`Line number ${index} of the script`);
  });

  it('says where a picture was when it cannot be drawn, in the space it would have taken', async () => {
    const broken = { ...media, a: { ...media.a, bytes: new Uint8Array([1, 2, 3]) } };
    const { bytes } = await compileStoryManuscript(
      { ...input([page('p1', 'a', 'Text.')]), media: broken },
      { format: 'pdf', pageLayout: 'sheet' },
    );

    expect(pdfPages(bytes)[0].words).toContain('Image removed');
  });
});
