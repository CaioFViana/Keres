/** @jest-environment node */
import type { CompiledManuscript } from '../../../src/components/features/manuscript/export/manuscriptCompiler';
import { exportManuscript } from '../../../src/components/features/manuscript/export/manuscriptExport';

const mockDeliverFile = jest.fn();
const mockBuildDocx = jest.fn();
const mockBuildHtml = jest.fn();
const mockPrintToFile = jest.fn();
const mockReadBytes = jest.fn();
const mockBuildMarkdown = jest.fn();
const mockBuildText = jest.fn();

jest.mock('../../../src/utils/storyTransfer', () => ({
  __esModule: true,
  buildManuscriptFileName: (storyTitle: string, extension: string) =>
    `${storyTitle}.${extension}`,
  deliverFile: (...args: unknown[]) => mockDeliverFile(...args),
}));

jest.mock('../../../src/components/features/manuscript/export/manuscriptDocx', () => ({
  __esModule: true,
  buildManuscriptDocxBase64: (...args: unknown[]) => mockBuildDocx(...args),
}));

jest.mock('../../../src/components/features/manuscript/export/manuscriptHtml', () => ({
  __esModule: true,
  buildManuscriptHtml: (...args: unknown[]) => mockBuildHtml(...args),
  printManuscriptPdf: (...args: unknown[]) => mockPrintToFile(...args),
}));

jest.mock('../../../src/components/features/manuscript/export/manuscriptText', () => ({
  __esModule: true,
  buildManuscriptMarkdown: (...args: unknown[]) => mockBuildMarkdown(...args),
  buildManuscriptText: (...args: unknown[]) => mockBuildText(...args),
}));

jest.mock('expo-file-system', () => ({
  __esModule: true,
  File: jest.fn().mockImplementation(() => ({ bytes: (...args: unknown[]) => mockReadBytes(...args) })),
}));

const manuscript = { title: 'My Story', blocks: [] } as unknown as CompiledManuscript;
const labels = { goToPage: 'Go to page', goToScene: 'See' };

beforeEach(() => {
  jest.clearAllMocks();
  mockDeliverFile.mockResolvedValue({ delivered: true, fileName: 'x' });
  mockBuildDocx.mockResolvedValue('UEsDBA==');
  mockBuildHtml.mockReturnValue('<html></html>');
  mockPrintToFile.mockResolvedValue({ uri: 'file:///tmp/out.pdf' });
  mockReadBytes.mockResolvedValue(new Uint8Array([37, 80, 68, 70]));
  mockBuildMarkdown.mockReturnValue('# My Story\n');
  mockBuildText.mockReturnValue('My Story\n');
});

describe('exportManuscript', () => {
  it('delivers docx bytes decoded from base64', async () => {
    await exportManuscript({ storyTitle: 'My Story', manuscript, format: 'docx', labels });

    expect(mockBuildDocx).toHaveBeenCalledWith(manuscript, labels);
    expect(mockDeliverFile).toHaveBeenCalledWith(
      new Uint8Array([80, 75, 3, 4]),
      'My Story.docx',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'org.openxmlformats.wordprocessingml.document',
    );
  });

  it('prints pdf to a temp file and delivers its bytes', async () => {
    await exportManuscript({ storyTitle: 'My Story', manuscript, format: 'pdf', labels });

    expect(mockBuildHtml).toHaveBeenCalledWith(manuscript, labels);
    expect(mockPrintToFile).toHaveBeenCalledWith('<html></html>');
    expect(mockDeliverFile).toHaveBeenCalledWith(
      new Uint8Array([37, 80, 68, 70]),
      'My Story.pdf',
      'application/pdf',
      'com.adobe.pdf',
    );
  });

  it('passes strikethrough spans through to the text builders', async () => {
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

    expect(mockBuildMarkdown).toHaveBeenCalledWith(struck, labels);
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
});
