/** @jest-environment node */
import type { CompiledManuscript } from '@keres/shared';
import { Platform } from 'react-native';
import { exportManuscript } from '../../../src/components/features/manuscript/export/manuscriptExport';

const mockDeliverFile = jest.fn();
const mockBuildManuscriptFileName = jest.fn(
  (...args: unknown[]) => `${args[0] as string}.${args[1] as string}`,
);

jest.mock('../../../src/utils/storyTransfer', () => ({
  __esModule: true,
  buildManuscriptFileName: (...args: unknown[]) => mockBuildManuscriptFileName(...args),
  deliverFile: (...args: unknown[]) => mockDeliverFile(...args),
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
