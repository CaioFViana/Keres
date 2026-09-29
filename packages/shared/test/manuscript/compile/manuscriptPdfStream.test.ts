import { describe, expect, it } from 'vitest';
import type {
  CompiledBlock,
  CompiledManuscript,
} from '../../../manuscript/compile/export/manuscriptCompiler';
import {
  flattenRuns,
  iterateRuns,
  paginate,
  paginateStream,
  pdfGeometry,
  type LineRun,
  type PlacedRun,
} from '../../../manuscript/compile/export/manuscriptPdfLayout';

const LABELS = { goToPage: 'Go to page', tocHeading: 'Contents' };

const paragraph = (text: string): CompiledBlock => ({
  kind: 'paragraph',
  spans: [{ text, bold: false, italic: false, underline: false, strikethrough: false }],
});

function book(paragraphs: number, extra: CompiledBlock[] = []): CompiledManuscript {
  const blocks: CompiledBlock[] = [{ kind: 'title', text: 'My Story' }, ...extra];
  for (let index = 0; index < paragraphs; index += 1) {
    blocks.push(
      paragraph(`Paragraph ${index} walks slowly through the empty square while it rains.`),
    );
  }
  return { title: 'My Story', blocks };
}

const chapter = (id: string, name: string, number: number): CompiledBlock => ({
  kind: 'chapter',
  id,
  number,
  name,
  bookmarkId: `chapter-${id}`,
});

describe('iterateRuns', () => {
  it('hands the lines over one block at a time instead of building the whole book', () => {
    const iterator = iterateRuns(book(500), LABELS, new Map(), {});

    const first = iterator.next();

    expect(first.done).toBe(false);
    expect((first.value as LineRun).words.map((word) => word.text).join(' ')).toBe('My Story');
    // What is left is still there to be asked for: nothing was computed ahead.
    expect(iterator.next().done).toBe(false);
  });

  it('is the same lines flattenRuns lists', () => {
    const manuscript = book(40, [chapter('a', 'One', 1)]);

    expect([...iterateRuns(manuscript, LABELS, new Map(), {})]).toEqual(
      flattenRuns(manuscript, LABELS, new Map(), {}),
    );
  });

  it('never hands over an empty line', () => {
    const manuscript = book(3, [{ kind: 'subtitle', text: '' }, paragraph('​')]);

    for (const run of iterateRuns(manuscript, LABELS, new Map(), {})) {
      expect(run.words.length).toBeGreaterThan(0);
    }
  });

  it('opens the page after the index with the first line that follows it', () => {
    const manuscript = book(2, [chapter('a', 'One', 1)]);
    const runs = flattenRuns(manuscript, LABELS, new Map(), { includeToc: true });

    const lastIndexLine = runs.map((run) => run.linkTarget !== null).lastIndexOf(true);
    expect(lastIndexLine).toBeGreaterThan(0);
    expect(runs[lastIndexLine + 1]?.forcePageBreak).toBe(true);
    // Without an index nothing forces that page.
    const plain = flattenRuns(book(2), LABELS, new Map(), {});
    expect(plain.some((run) => run.forcePageBreak)).toBe(false);
  });
});

describe('paginateStream', () => {
  const geometry = pdfGeometry({});

  it('hands each page over when it is full, not when the book is done', () => {
    let yielded = 0;
    const total = flattenRuns(book(400), LABELS, new Map(), {}).length;
    function* counted() {
      for (const run of iterateRuns(book(400), LABELS, new Map(), {})) {
        yielded += 1;
        yield run;
      }
    }

    const seenAtFirstPage: number[] = [];
    paginateStream(counted(), geometry, (_page, index) => {
      if (index === 0) seenAtFirstPage.push(yielded);
    });

    expect(seenAtFirstPage).toHaveLength(1);
    // The first page was out long before the last line was even laid out.
    expect(seenAtFirstPage[0]).toBeLessThan(total / 4);
  });

  it('reports the pages in order, once each, and where every heading landed', () => {
    const pages: number[] = [];
    const manuscript = book(300, [chapter('a', 'One', 1)]);

    const { anchors, pageCount } = paginateStream(
      iterateRuns(manuscript, LABELS, new Map(), {}),
      geometry,
      (_page, index) => pages.push(index),
    );

    expect(pages).toEqual(Array.from({ length: pageCount }, (_, index) => index));
    expect(pageCount).toBeGreaterThan(3);
    expect(anchors.get('chapter-a')?.page).toBe(1);
  });

  it('is the pages paginate lists, with a page for an empty book too', () => {
    const runs = flattenRuns(book(150), LABELS, new Map(), {});
    const streamed: PlacedRun[][] = [];
    paginateStream(runs, geometry, (page) => streamed.push(page));

    expect(streamed).toEqual(paginate(runs, geometry).pages);
    const empty: PlacedRun[][] = [];
    expect(paginateStream([], geometry, (page) => empty.push(page)).pageCount).toBe(1);
    expect(empty).toEqual([[]]);
  });

  it('keeps a heading with the line after it across a page turn', () => {
    const heading: LineRun = {
      words: [{ text: 'H', font: 'times-bold', width: 8, underline: false, strikethrough: false }],
      size: 12,
      leading: 14,
      indent: 0,
      spaceBefore: 0,
      spaceAfter: 0,
      centered: false,
      gray: 0,
      bookmarkId: 'h',
      linkTarget: null,
      keepWithNext: true,
      forcePageBreak: false,
    };
    const filler: LineRun = { ...heading, bookmarkId: null, keepWithNext: false };
    const fits = Math.floor((geometry.topY - geometry.bottomY) / 14);
    // Filler up to the last line that fits, then a heading that would be left alone at the foot.
    const runs = [...Array.from({ length: fits - 1 }, () => filler), heading, filler];

    const { anchors } = paginateStream(runs, geometry, () => undefined);

    expect(anchors.get('h')?.page).toBe(2);
  });
});
