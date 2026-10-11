import JSZip from 'jszip';
import { inflate } from 'pako';
import { describe, expect, it } from 'vitest';
import { compileStoryManuscript } from '../../../manuscript/compile/compileStoryManuscript';
import type { ManuscriptOptionsInput } from '../../../manuscript/compile/manuscriptContracts';
import type { CompileStoryManuscriptInput } from '../../../manuscript/compile/presentedManuscript';
import { solidPng } from '../images/imageFixtures';

const input = (cover: string | undefined = 'cover'): CompileStoryManuscriptInput => ({
  storyTitle: 'The Roof',
  storyType: 'linear',
  chapters: [{ id: 'ch', name: 'Issue one', index: 1, type: 'chapter' }],
  scenes: [
    {
      id: 's1',
      chapterId: 'ch',
      name: 's1',
      index: 1,
      body: 'The city sleeps.',
      isDeleted: false,
    },
  ],
  choices: [],
  media: { cover: solidPng(300, 450, [200, 60, 60, 255]) },
  ...(cover ? { cover } : {}),
});

const compile = (options: ManuscriptOptionsInput, cover?: string) =>
  compileStoryManuscript(input(cover), options);
const decode = (bytes: Uint8Array) => new TextDecoder().decode(bytes);
const latin1 = (bytes: Uint8Array) =>
  Array.from(bytes, (byte) => String.fromCharCode(byte)).join('');

describe('the cover of a book', () => {
  it('opens an HTML file, before the title, as a picture that has its own page', async () => {
    const html = decode((await compile({ format: 'html' })).bytes);

    expect(html.indexOf('<figure class="cover">')).toBeGreaterThan(-1);
    expect(html.indexOf('<figure class="cover">')).toBeLessThan(html.indexOf('<h1 class="title">'));
    expect(html).toContain('data:image/png;base64,');
    expect(html).toContain('figure.cover');
  });

  it('is no cover at all when the picture is not among the pictures it was given', async () => {
    const html = decode((await compile({ format: 'html' }, 'missing')).bytes);

    expect(html).not.toContain('class="cover"');
    expect(html).not.toContain('figure.cover');
  });

  it('is nothing when there is none', async () => {
    const html = decode((await compile({ format: 'html' }, '')).bytes);

    expect(html).not.toContain('class="cover"');
  });

  it('is the cover of an EPUB: an image of its own, a cover page first in the reading order, and the metadata that names it', async () => {
    const zip = await JSZip.loadAsync((await compile({ format: 'epub' })).bytes);
    const opf = await zip.file('OEBPS/content.opf')!.async('string');

    expect(zip.file('OEBPS/images/cover.png')).not.toBeNull();
    expect(opf).toContain(
      '<item id="cover-image" href="images/cover.png" media-type="image/png" properties="cover-image"/>',
    );
    expect(opf).toContain('<meta name="cover" content="cover-image"/>');
    expect(opf.indexOf('<itemref idref="cover"/>')).toBeLessThan(
      opf.indexOf('<itemref idref="text0"/>'),
    );
    expect(await zip.file('OEBPS/cover.xhtml')!.async('string')).toContain(
      '<img src="images/cover.png"',
    );
  });

  it('leaves an EPUB without a cover exactly as it was', async () => {
    const zip = await JSZip.loadAsync((await compile({ format: 'epub' }, '')).bytes);

    expect(zip.file('OEBPS/cover.xhtml')).toBeNull();
    expect(await zip.file('OEBPS/content.opf')!.async('string')).not.toContain('cover-image');
  });

  it('is the first page of a Word document, with a page break after it', async () => {
    const zip = await JSZip.loadAsync((await compile({ format: 'docx' })).bytes);
    const xml = await zip.file('word/document.xml')!.async('string');

    expect(xml.indexOf('<w:drawing>')).toBeGreaterThan(-1);
    const titleAt = xml.search(/<w:t[^>]*>The Roof</);
    expect(xml.indexOf('<w:drawing>')).toBeLessThan(titleAt);
    expect(xml.indexOf('<w:br w:type="page"/>')).toBeLessThan(titleAt);
  });

  it('is the first sheet of a PDF, a picture alone, and the title opens the next', async () => {
    const { bytes } = await compile({ format: 'pdf' });
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

    expect(pages[0].pictures).toBe(1);
    expect(pages[0].words).not.toContain('The Roof');
    expect(pages[1].words).toContain('The Roof');
  });

  it('leaves Markdown and plain text alone: they carry no pictures', async () => {
    const md = decode((await compile({ format: 'md' })).bytes);

    expect(md.startsWith('# The Roof')).toBe(true);
  });
});
