/** @jest-environment node */
import type { CompiledManuscript } from '@keres/shared';
import { Platform } from 'react-native';
import { exportManuscript } from '../../../src/components/features/manuscript/export/manuscriptExport';

const mockDeliverFile = jest.fn();
const mockBuildDocxBytes = jest.fn();
const mockPrintToFile = jest.fn();
const mockReadBytes = jest.fn();

jest.mock('../../../src/utils/storyTransfer', () => ({
  __esModule: true,
  buildManuscriptFileName: (storyTitle: string, extension: string) =>
    `${storyTitle}.${extension}`,
  deliverFile: (...args: unknown[]) => mockDeliverFile(...args),
}));

// Only the zip packer is doubled: md/txt/html run through the real shared
// renderers, so this file also guards the shared wiring.
jest.mock('@keres/shared', () => {
  const actual = jest.requireActual('@keres/shared');
  return {
    ...actual,
    buildManuscriptDocxBytes: (...args: unknown[]) => mockBuildDocxBytes(...args),
  };
});

jest.mock('expo-print', () => ({
  __esModule: true,
  printToFileAsync: (...args: unknown[]) => mockPrintToFile(...args),
}));

jest.mock('expo-file-system', () => ({
  __esModule: true,
  File: jest.fn().mockImplementation(() => ({ bytes: (...args: unknown[]) => mockReadBytes(...args) })),
}));

const manuscript = {
  title: 'My Story',
  blocks: [{ kind: 'title', text: 'My Story' }],
} as unknown as CompiledManuscript;
const labels = { goToPage: 'Go to page', goToScene: 'See', tocHeading: 'Contents' };

beforeEach(() => {
  jest.clearAllMocks();
  mockDeliverFile.mockResolvedValue({ delivered: true, fileName: 'x' });
  mockBuildDocxBytes.mockResolvedValue(new Uint8Array([80, 75, 3, 4]));
  mockPrintToFile.mockResolvedValue({ uri: 'file:///tmp/out.pdf' });
  mockReadBytes.mockResolvedValue(new Uint8Array([37, 80, 68, 70]));
});

describe('exportManuscript', () => {
  it('delivers docx bytes from the shared builder', async () => {
    await exportManuscript({ storyTitle: 'My Story', manuscript, format: 'docx', labels });

    expect(mockBuildDocxBytes).toHaveBeenCalledWith(manuscript, labels, {});
    expect(mockDeliverFile).toHaveBeenCalledWith(
      new Uint8Array([80, 75, 3, 4]),
      'My Story.docx',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'org.openxmlformats.wordprocessingml.document',
    );
  });

  it('prints pdf to a temp file and delivers its bytes', async () => {
    await exportManuscript({ storyTitle: 'My Story', manuscript, format: 'pdf', labels });

    expect(mockPrintToFile).toHaveBeenCalledWith({
      html: expect.stringContaining('<title>My Story</title>'),
    });
    expect(mockDeliverFile).toHaveBeenCalledWith(
      new Uint8Array([37, 80, 68, 70]),
      'My Story.pdf',
      'application/pdf',
      'com.adobe.pdf',
    );
  });

  it('draws pdf bytes directly on web, where there is no print pipeline', async () => {
    const restorePlatform = jest.replaceProperty(Platform, 'OS', 'web');
    try {
      await exportManuscript({ storyTitle: 'My Story', manuscript, format: 'pdf', labels });

      expect(mockPrintToFile).not.toHaveBeenCalled();
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

  it('forwards render options to the shared builders', async () => {
    await exportManuscript({
      storyTitle: 'My Story',
      manuscript,
      format: 'docx',
      labels,
      options: { includeToc: true },
    });

    expect(mockBuildDocxBytes).toHaveBeenCalledWith(manuscript, labels, { includeToc: true });
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
});


