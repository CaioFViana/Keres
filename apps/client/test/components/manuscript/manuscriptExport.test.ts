/** @jest-environment node */
import type { CompiledManuscript } from '@keres/shared';
import { readFileSync } from 'fs';
import { join } from 'path';
import { Platform } from 'react-native';
import { exportManuscript } from '@/src/components/features/manuscript/export/manuscriptExport';

const mockDeliverFile = jest.fn();
const mockBuildManuscriptFileName = jest.fn(
  (...args: unknown[]) => `${args[0] as string}.${args[1] as string}`,
);
const mockPdfFontMatrices = jest.fn();

jest.mock('@/src/utils/io/storyTransfer', () => ({
  __esModule: true,
  buildManuscriptFileName: (...args: unknown[]) => mockBuildManuscriptFileName(...args),
  deliverFile: (...args: unknown[]) => mockDeliverFile(...args),
}));
jest.mock('@/src/utils/io/pdfFontAssets', () => ({
  __esModule: true,
  pdfFontMatrices: (...args: unknown[]) => mockPdfFontMatrices(...args),
}));

// Every format runs through the real shared renderers, so this file also guards the wiring.
const manuscript = {
  title: 'My Story',
  blocks: [{ kind: 'title', text: 'My Story' }],
} as unknown as CompiledManuscript;
const labels = { goToPage: 'Go to page', goToScene: 'See', tocHeading: 'Contents' };

beforeEach(() => {
  jest.clearAllMocks();
  mockDeliverFile.mockResolvedValue({ delivered: true, fileName: 'x' });
  // The real serif loader cannot fetch its asset under Jest and answers null after logging a warning;
  // the loader itself is tested in pdfFontAssets.test.ts, and the wiring tests below override per case.
  mockPdfFontMatrices.mockResolvedValue(null);
});

describe('exportManuscript', () => {
  it('delivers docx bytes from the shared builder', async () => {
    await exportManuscript({ storyTitle: 'My Story', manuscript, format: 'docx', labels });

    const [bytes, fileName, mimeType, uti] = mockDeliverFile.mock.calls[0];
    expect(Array.from((bytes as Uint8Array).slice(0, 2))).toEqual([0x50, 0x4b]);
    expect(fileName).toBe('My Story.docx');
    expect(mimeType).toBe(
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    );
    expect(uti).toBe('org.openxmlformats.wordprocessingml.document');
  });

  /** One pipeline everywhere: the pure-TypeScript renderer, on native as on web. */
  it.each(['ios', 'android', 'web'] as const)('draws pdf bytes directly on %s', async (os) => {
    const restorePlatform = jest.replaceProperty(Platform, 'OS', os);
    try {
      await exportManuscript({ storyTitle: 'My Story', manuscript, format: 'pdf', labels });

      expect(mockDeliverFile).toHaveBeenCalledTimes(1);
      const [bytes, fileName, mimeType, uti] = mockDeliverFile.mock.calls[0];
      expect((bytes as Uint8Array).slice(0, 5)).toEqual(
        new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]),
      );
      expect(fileName).toBe('My Story.pdf');
      expect(mimeType).toBe('application/pdf');
      expect(uti).toBe('com.adobe.pdf');
    } finally {
      restorePlatform.restore();
    }
  });

  it('packs an epub whose first entry is its stored mimetype', async () => {
    await exportManuscript({
      storyTitle: 'My Story',
      manuscript,
      format: 'epub',
      labels,
      metadata: { author: 'Ana', language: 'pt-BR' },
    });

    const [bytes, fileName, mimeType, uti] = mockDeliverFile.mock.calls[0];
    const head = Buffer.from(bytes as Uint8Array).toString('latin1');
    expect(head.startsWith('PK')).toBe(true);
    expect(head.slice(30, 58)).toBe('mimetypeapplication/epub+zip');
    expect(fileName).toBe('My Story.epub');
    expect(mimeType).toBe('application/epub+zip');
    expect(uti).toBe('org.idpf.epub-container');
  });

  it('delivers html from the shared renderer', async () => {
    await exportManuscript({ storyTitle: 'My Story', manuscript, format: 'html', labels });

    expect(mockDeliverFile).toHaveBeenCalledWith(
      expect.stringContaining('<title>My Story</title>'),
      'My Story.html',
      'text/html',
      'public.html',
    );
  });

  it('passes strikethrough spans through to the shared text builder', async () => {
    const struck = {
      title: 'My Story',
      blocks: [
        {
          kind: 'paragraph',
          spans: [
            { text: 'A ', bold: false, italic: false, underline: false, strikethrough: false },
            { text: 'cut', bold: false, italic: false, underline: false, strikethrough: true },
          ],
        },
      ],
    } as unknown as CompiledManuscript;

    await exportManuscript({ storyTitle: 'My Story', manuscript: struck, format: 'md', labels });

    expect(mockDeliverFile).toHaveBeenCalledWith(
      expect.stringContaining('~~cut~~'),
      'My Story.md',
      'text/markdown',
      'public.plain-text',
    );
  });

  it.each([
    ['md', 'My Story.md', 'text/markdown'],
    ['txt', 'My Story.txt', 'text/plain'],
  ] as const)('delivers %s as text', async (format, fileName, mimeType) => {
    await exportManuscript({ storyTitle: 'My Story', manuscript, format, labels });

    expect(mockDeliverFile).toHaveBeenCalledWith(
      expect.stringContaining('My Story'),
      fileName,
      mimeType,
      'public.plain-text',
    );
  });

  it('presents the manuscript as the style asks before drawing it', async () => {
    const withChapter = {
      title: 'My Story',
      blocks: [
        { kind: 'title', text: 'My Story' },
        { kind: 'chapter', id: 'ch-1', number: 4, name: 'Arrival', bookmarkId: 'chapter-ch1' },
      ],
    } as unknown as CompiledManuscript;

    await exportManuscript({
      storyTitle: 'My Story',
      manuscript: withChapter,
      format: 'html',
      labels,
      style: {
        chapterNumbering: 'roman',
        frontMatter: ['by <$author>'],
        placeholders: { author: 'Ana' },
      },
    });

    const [html] = mockDeliverFile.mock.calls[0];
    expect(html).toContain('IV. Arrival');
    expect(html).toContain('<p class="subtitle">by Ana</p>');
  });

  it('renders the shared markdown index when enabled', async () => {
    const withChapter = {
      title: 'My Story',
      blocks: [
        { kind: 'title', text: 'My Story' },
        { kind: 'chapter', id: 'ch-1', number: 1, name: 'Arrival', bookmarkId: 'chapter-ch1' },
      ],
    } as unknown as CompiledManuscript;

    await exportManuscript({
      storyTitle: 'My Story',
      manuscript: withChapter,
      format: 'md',
      labels,
      options: { includeToc: true },
    });

    expect(mockDeliverFile).toHaveBeenCalledWith(
      expect.stringContaining('- [1. Arrival](#chapter-ch1)'),
      'My Story.md',
      'text/markdown',
      'public.plain-text',
    );
  });

  it('reports unicodePdf false for non-pdf formats', async () => {
    const result = await exportManuscript({
      storyTitle: 'My Story',
      manuscript,
      format: 'docx',
      labels,
    });

    expect(result.unicodePdf).toBe(false);
  });

  it('reports unicodePdf false when only the CJK pack is present but the serif failed', async () => {
    // The reported web bug: the pack downloaded fine, but the serif never
    // loaded, so the matrix was silently discarded into the legacy path.
    mockPdfFontMatrices.mockResolvedValue(null);

    const result = await exportManuscript({
      storyTitle: 'My Story',
      manuscript,
      format: 'pdf',
      labels,
      cjkMatrix: new Uint8Array([9, 9, 9]),
    });

    expect(result.unicodePdf).toBe(false);
    expect(mockDeliverFile).toHaveBeenCalledTimes(1);
    const [bytes] = mockDeliverFile.mock.calls[0];
    expect((bytes as Uint8Array).slice(0, 5)).toEqual(
      new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]),
    );
  });

  it('embeds subsets and reports unicodePdf true when both matrices are present', async () => {
    const roboto = new Uint8Array(
      readFileSync(
        join(__dirname, '../../../../../packages/shared/test/fixtures/fonts/Roboto-Regular.ttf'),
      ),
    );
    mockPdfFontMatrices.mockResolvedValue({ regular: roboto, italic: roboto });

    const result = await exportManuscript({
      storyTitle: 'My Story',
      manuscript,
      format: 'pdf',
      labels,
      cjkMatrix: roboto,
    });

    expect(result.unicodePdf).toBe(true);
    const [bytes] = mockDeliverFile.mock.calls[0];
    const head = Buffer.from(bytes as Uint8Array).toString('latin1');
    expect(head).toContain('Identity-H');
  });

  it('passes the app language to the file name builder, defaulting to English', async () => {
    await exportManuscript({ storyTitle: 'My Story', manuscript, format: 'md', labels });

    expect(mockBuildManuscriptFileName).toHaveBeenCalledWith(
      'My Story',
      'md',
      expect.any(Date),
      'en',
    );

    await exportManuscript({
      storyTitle: 'My Story',
      manuscript,
      format: 'md',
      labels,
      language: 'pt',
    });

    expect(mockBuildManuscriptFileName).toHaveBeenLastCalledWith(
      'My Story',
      'md',
      expect.any(Date),
      'pt',
    );
  });
});

describe('a comic through exportManuscript', () => {
  /** A one-pixel PNG: enough for its header to be read and for the picture to be embedded. */
  const png = {
    mimeType: 'image/png' as const,
    width: 2,
    height: 1,
    bytes: Uint8Array.from(
      Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
        'base64',
      ),
    ),
  };
  const comic = (extra: Record<string, unknown> = {}) =>
    ({
      title: 'The Roof',
      blocks: [
        { kind: 'title', text: 'The Roof' },
        {
          kind: 'page',
          id: 'p1',
          label: 'Page 1',
          number: 1,
          spread: false,
          text: ['Panel 1: she waits.'],
          image: { mediaId: 'a', fit: 'contain' },
          placeholder: 'Image removed',
        },
      ],
      images: { a: png, cover: png },
      pageAspect: 0.65,
      ...extra,
    }) as unknown as CompiledManuscript;
  const htmlOf = async (manuscript: CompiledManuscript) => {
    await exportManuscript({ storyTitle: 'The Roof', manuscript, format: 'html', labels });
    const delivered = mockDeliverFile.mock.calls[0][0] as string | Uint8Array;
    return typeof delivered === 'string' ? delivered : Buffer.from(delivered).toString('utf8');
  };

  it('sets the page as a planning sheet, with its text in it, when the manuscript says so', async () => {
    const html = await htmlOf(comic({ pageLayout: 'sheet' }));

    expect(html).toContain('<figure class="page sheet"');
    expect(html).toContain('<p>Panel 1: she waits.</p>');
  });

  it('sets the pages in spreads', async () => {
    const html = await htmlOf(comic({ pageLayout: 'spreads' }));

    expect(html).toContain('<section class="spread">');
  });

  it('puts the cover first, before the title', async () => {
    const html = await htmlOf(comic({ pageLayout: 'sheet', cover: 'cover' }));

    expect(html.indexOf('<figure class="cover">')).toBeGreaterThan(-1);
    expect(html.indexOf('<figure class="cover">')).toBeLessThan(html.indexOf('<h1 class="title">'));
  });

  it('leaves out what it was not given: no cover, and no sheet for a flow', async () => {
    const html = await htmlOf(comic());

    expect(html).not.toContain('class="cover"');
    expect(html).not.toContain('page sheet');
  });
});
