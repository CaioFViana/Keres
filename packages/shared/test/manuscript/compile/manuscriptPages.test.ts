import JSZip from 'jszip';
import { inflate } from 'pako';
import { describe, expect, it } from 'vitest';
import { compileStoryManuscript } from '../../../manuscript/compile/compileStoryManuscript';
import type { ManuscriptOptionsInput } from '../../../manuscript/compile/manuscriptContracts';
import type {
  ManuscriptChapter,
  ManuscriptPage,
  ManuscriptScene,
} from '../../../manuscript/compile/manuscriptSections';
import type { CompileStoryManuscriptInput } from '../../../manuscript/compile/presentedManuscript';
import { presentedManuscriptOf } from '../../../manuscript/compile/presentedManuscript';
import { presentManuscript } from '../../../manuscript/compile/manuscriptStyle';
import {
  DEFAULT_MANUSCRIPT_LABELS,
  ManuscriptOptionsSchema,
} from '../../../manuscript/compile/manuscriptContracts';
import type { ManuscriptImage } from '../../../manuscript/images/imageInfo';
import { compileStoryReader } from '../../../manuscript/reader/storyReader';
import { jpegOf, solidPng } from '../images/imageFixtures';

const page = (id: string, mediaId: string | null, text: string | null, fit = 'contain') =>
  ({ id, mediaId, text, fit }) as ManuscriptPage;

const chapters: ManuscriptChapter[] = [
  { id: 'ch-1', name: 'Issue one', index: 1, type: 'chapter' },
];

function scene(id: string, index: number, pages: ManuscriptPage[], body: string | null = null) {
  return {
    id,
    chapterId: 'ch-1',
    name: id,
    index,
    body,
    isDeleted: false,
    pages,
  } satisfies ManuscriptScene;
}

function input(
  media: Record<string, ManuscriptImage>,
  scenes: ManuscriptScene[],
): CompileStoryManuscriptInput {
  return { storyTitle: 'Comic', storyType: 'linear', chapters, scenes, choices: [], media };
}

const decode = (bytes: Uint8Array) => new TextDecoder().decode(bytes);
const latin1 = (bytes: Uint8Array) =>
  Array.from(bytes, (byte) => String.fromCharCode(byte)).join('');

const roundOptions = (options: ManuscriptOptionsInput) => options;

/** The drawing commands of every page: the deflated streams that open with a length and a Flate filter. */
function pageContents(bytes: Uint8Array): string {
  const text = latin1(bytes);
  const out: string[] = [];
  for (const match of text.matchAll(/\/Length (\d+) \/Filter \/FlateDecode >>\nstream\n/g)) {
    const start = match.index + match[0].length;
    try {
      const raw = latin1(inflate(bytes.subarray(start, start + Number(match[1]))));
      if (raw.includes(' Tf') || raw.includes(' Do')) out.push(raw);
    } catch {
      // A picture's own stream, not a page.
    }
  }
  return out.join('\n');
}

describe('page blocks', () => {
  const media = { a: solidPng(40, 60), b: solidPng(60, 40) };
  const scenes = [
    scene('s1', 1, [
      page('p1', 'a', 'PANEL 1\nHe looks up.\n\nTHE KID: Hey!'),
      page('p2', 'b', null),
    ]),
    scene('s2', 2, [page('p3', null, 'Lost art')]),
  ];
  const compile = (options: Partial<ManuscriptOptionsInput> = {}) =>
    presentedManuscriptOf(
      input(media, scenes),
      ManuscriptOptionsSchema.parse({ format: 'html', ...options }),
      DEFAULT_MANUSCRIPT_LABELS,
    );

  it('numbers pages through the whole manuscript, each followed by its text a line at a time', () => {
    const kinds = compile().blocks.map((block) =>
      block.kind === 'page'
        ? `page:${block.label}`
        : block.kind === 'paragraph'
          ? `p:${block.spans[0].text}`
          : block.kind,
    );

    expect(kinds).toEqual([
      'title',
      'chapter',
      'page:Page 1',
      'p:PANEL 1',
      'p:He looks up.',
      'p:THE KID: Hey!',
      'page:Page 2',
    ]);
  });

  it('captions frames in a storyboard', () => {
    const labels = compile({ pageNoun: 'frame' }).blocks.filter((block) => block.kind === 'page');

    expect(labels.map((block) => block.label)).toEqual(['Frame 1', 'Frame 2']);
  });

  it('leaves a page whose picture is gone out of the manuscript, unnumbered, with its text', () => {
    const blocks = compile().blocks;

    expect(blocks.some((block) => block.kind === 'page' && block.id === 'p3')).toBe(false);
    expect(JSON.stringify(blocks)).not.toContain('Lost art');
  });

  it('keeps a page whose picture is named but missing from the table, as a placeholder', () => {
    const blocks = presentedManuscriptOf(
      input({}, [scene('s1', 1, [page('p1', 'nowhere', 'text')])]),
      ManuscriptOptionsSchema.parse({ format: 'html' }),
      DEFAULT_MANUSCRIPT_LABELS,
    ).blocks;

    expect(blocks.find((block) => block.kind === 'page')).toMatchObject({
      image: { mediaId: 'nowhere' },
      placeholder: 'Image removed',
    });
  });

  it('carries the pictures and the frame the pages are shown in', () => {
    const compiled = compile({ pageFormat: 'wide' });

    expect(Object.keys(compiled.images ?? {})).toEqual(['a', 'b']);
    expect(compiled.pageAspect).toBeCloseTo(16 / 9);
  });
});

describe('pages in the renderers', () => {
  const media = { a: solidPng(40, 60, [10, 20, 30, 255]), b: solidPng(60, 40, [9, 9, 9, 128]) };
  const scenes = [
    scene('s1', 1, [
      page('p1', 'a', 'Caption one'),
      page('p2', 'b', 'Caption two', 'cover'),
      page('p3', 'a', null),
      page('p4', null, 'Lost'),
    ]),
  ];
  const compile = (options: ManuscriptOptionsInput) =>
    compileStoryManuscript(input(media, scenes), roundOptions(options));

  it('writes an HTML with each picture inline, cropped by a frame only when it fills', async () => {
    const { bytes } = await compile({ format: 'html' });
    const html = decode(bytes);

    expect(html).toContain('<figcaption>Page 1</figcaption>');
    expect(html.match(/<img src="data:image\/png;base64,/g)).toHaveLength(3);
    expect(html).toContain('class="frame" style="aspect-ratio: 0.6463"');
    expect(html.match(/class="frame"/g)).toHaveLength(1);
    expect(html).not.toContain('Image removed');
    expect(html).not.toContain('Lost');
    expect(html).toContain('<p>Caption one</p>');
    expect(html).toContain('figure.page');
  });

  it('leaves a manuscript without pages exactly as it was', async () => {
    const plain = await compileStoryManuscript(input({}, [scene('s1', 1, [], 'Prose.')]), {
      format: 'html',
    });

    expect(decode(plain.bytes)).not.toContain('figure.page');
  });

  it('packs each picture once into the EPUB, and the manifest and pages agree on where it is', async () => {
    const { bytes } = await compile({ format: 'epub' });
    const zip = await JSZip.loadAsync(bytes);
    const files = Object.keys(zip.files).filter(
      (name) => name.startsWith('OEBPS/images/') && !name.endsWith('/'),
    );
    const opf = await zip.file('OEBPS/content.opf')!.async('string');
    const text = (
      await Promise.all(
        Object.keys(zip.files)
          .filter((name) => /^OEBPS\/text-\d+\.xhtml$/.test(name))
          .map((name) => zip.file(name)!.async('string')),
      )
    ).join('\n');

    expect(files.sort()).toEqual(['OEBPS/images/page-1.png', 'OEBPS/images/page-2.png']);
    expect(opf).toContain('href="images/page-1.png" media-type="image/png"');
    expect(opf).toContain('href="images/page-2.png" media-type="image/png"');
    expect(text).toContain('src="images/page-1.png"');
    expect(text).toContain('src="images/page-2.png"');
    // Page 3 shows the first picture again: still one file.
    expect(text.match(/src="images\/page-1.png"/g)).toHaveLength(2);
    const stored = await zip.file('OEBPS/images/page-1.png')!.async('uint8array');
    expect(Array.from(stored)).toEqual(Array.from(media.a.bytes));
  });

  it('puts the pictures in the DOCX as media', async () => {
    const { bytes } = await compile({ format: 'docx' });
    const zip = await JSZip.loadAsync(bytes);
    const media = Object.keys(zip.files).filter((name) => name.startsWith('word/media/'));
    const document = await zip.file('word/document.xml')!.async('string');

    expect(media.length).toBeGreaterThanOrEqual(1);
    expect(document).toContain('Page 1');
    expect(document).not.toContain('Image removed');
    expect(document).toContain('<w:drawing>');
  });

  it('draws the pictures in the PDF: one object each, a soft mask where translucent, a crop where filled', async () => {
    const { bytes } = await compile({ format: 'pdf' });
    const pdf = latin1(bytes);

    expect(pdf.match(/\/Subtype \/Image/g)).toHaveLength(3); // a, b and b's soft mask
    expect(pdf).toContain('/SMask');
    expect(pdf).toContain('/XObject <<');
    // The page that fills its frame is clipped, the others are not.
    const contents = pageContents(bytes);
    expect(contents.match(/ re W n /g)).toHaveLength(1);
    expect(contents.match(/\/Im1 Do/g)).toHaveLength(2);
    expect(contents.match(/\/Im2 Do/g)).toHaveLength(1);
  });

  it('writes the same picture of a JPEG without touching its bytes', async () => {
    const jpeg = jpegOf(30, 30, 3);
    const { bytes } = await compileStoryManuscript(
      input({ j: jpeg }, [scene('s1', 1, [page('p1', 'j', 'x')])]),
      { format: 'pdf' },
    );
    const pdf = latin1(bytes);

    expect(pdf).toContain('/Filter /DCTDecode');
    expect(pdf).toContain(latin1(jpeg.bytes));
  });

  it('says in markdown and text only the caption and the text of a page, never a picture', async () => {
    const md = decode((await compile({ format: 'md' })).bytes);
    const txt = decode((await compile({ format: 'txt' })).bytes);

    expect(md).toContain('**Page 1**');
    expect(md).not.toContain('Image removed');
    expect(txt).toContain('Page 1');
    expect(txt).not.toContain('Image removed');
    expect(md).not.toContain('data:image');
  });

  it('treats a picture it cannot embed as a missing one in the PDF', async () => {
    const damaged: ManuscriptImage = {
      bytes: solidPng(2, 2).bytes.slice(0, 40),
      mimeType: 'image/png',
      width: 2,
      height: 2,
    };
    const { bytes } = await compileStoryManuscript(
      input({ d: damaged }, [scene('s1', 1, [page('p1', 'd', 'still here')])]),
      { format: 'pdf' },
    );

    expect(latin1(bytes)).not.toContain('/Subtype /Image');
  });

  it('keeps a tall picture on a page of its own, whole, however many come before', async () => {
    const tall = solidPng(10, 400);
    const many = Array.from({ length: 6 }, (_, index) => page(`p${index}`, 't', `n${index}`));
    const { bytes } = await compileStoryManuscript(input({ t: tall }, [scene('s1', 1, many)]), {
      format: 'pdf',
      pageFormat: 'a5',
    });
    const pdf = latin1(bytes);
    const pages = pdf.match(/\/Type \/Page /g)?.length ?? 0;

    expect(pages).toBeGreaterThanOrEqual(3);
  });
});

describe('pages in the online reader', () => {
  const media = { a: solidPng(8, 8) };
  const scenes = [scene('s1', 1, [page('p1', 'a', 'Caption'), page('p2', null, null)])];

  it('puts the pictures inside a linear reader page, with their stylesheet', () => {
    const { bytes } = compileStoryReader(input(media, scenes) as never, {} as never);
    const html = decode(bytes);

    expect(html).toContain('<figcaption>Page 1</figcaption>');
    expect(html).toContain('data:image/png;base64,');
    expect(html).toContain('figure.page');
    expect(html).not.toContain('Image removed');
  });

  it('carries the pages of a branching story in the scene they belong to', () => {
    const branching = {
      ...input(media, [{ ...scenes[0], isStart: true }]),
      storyType: 'branching' as const,
    };
    const { bytes } = compileStoryReader(branching as never, { includeSceneNames: true } as never);
    const html = decode(bytes);
    const data = JSON.parse(
      html.match(/id="story-data">([\s\S]*?)<\/script>/)![1].replace(/\u003c/g, '<'),
    );

    expect(data.scenes.s1.html).toContain('<figcaption>Page 1</figcaption>');
    expect(data.scenes.s1.html).toContain('data:image/png;base64,');
    expect(html).toContain('figure.page');
  });
});

describe('presenting a manuscript with pages', () => {
  it('keeps the pictures and their frame, which only the words of a style may change', () => {
    const media = { a: solidPng(4, 4) };
    const compiled = presentedManuscriptOf(
      input(media, [scene('s1', 1, [page('p1', 'a', null)])]),
      ManuscriptOptionsSchema.parse({ format: 'pdf', pageFormat: 'b5' }),
      DEFAULT_MANUSCRIPT_LABELS,
    );

    const presented = presentManuscript(compiled, { quotes: 'curly' });

    expect(presented.images).toBe(compiled.images);
    expect(presented.pageAspect).toBe(compiled.pageAspect);
    expect(presented.blocks.find((block) => block.kind === 'page')).toMatchObject({
      label: 'Page 1',
    });
  });
});
