/** @jest-environment node */
import {
  importStoryFromSource,
  importStoryZipBytes,
} from '@/src/services/storymanagement/story-lifecycle/StoryImportService';

const mockImportFullStory = jest.fn();
const mockWriteDownloaded = jest.fn();
const mockExtractStoryZip = jest.fn();

jest.mock('@/src/services/storymanagement/story-lifecycle/StoryService', () => ({
  createStoryService: () => ({
    importFullStory: (...args: unknown[]) => mockImportFullStory(...args),
  }),
}));
jest.mock('@/src/services/media/MediaFileService', () => ({
  mediaFileService: {
    writeDownloaded: (...args: unknown[]) => mockWriteDownloaded(...args),
  },
}));
jest.mock('@/src/services/media/storyMediaBundle', () => ({
  extractStoryZip: (...args: unknown[]) => mockExtractStoryZip(...args),
}));

const db = {} as never;
const story = { story: { title: 'Casa' } } as never;

beforeEach(() => {
  jest.clearAllMocks();
  mockImportFullStory.mockResolvedValue(undefined);
  mockWriteDownloaded.mockImplementation(async (_story: string, hash: string) => `/local/${hash}`);
});

describe('importStoryFromSource', () => {
  it('writes the media first, then makes a local copy under one new id', async () => {
    const media = [
      { hash: 'h1', mimeType: 'image/png', bytes: new Uint8Array([1]) },
      { hash: 'h2', mimeType: 'image/jpeg', bytes: new Uint8Array([2]) },
    ];

    const result = await importStoryFromSource(db, 'user-1', { story, media });

    expect(result.title).toBe('Casa');
    expect(mockWriteDownloaded).toHaveBeenCalledWith(
      result.storyId,
      'h1',
      'image/png',
      media[0]!.bytes,
    );
    expect(mockWriteDownloaded).toHaveBeenCalledWith(
      result.storyId,
      'h2',
      'image/jpeg',
      media[1]!.bytes,
    );
    // Not linked to a server, and told which paths the media went to.
    expect(mockImportFullStory).toHaveBeenCalledWith(
      'user-1',
      story,
      null,
      null,
      new Map([
        ['h1', '/local/h1'],
        ['h2', '/local/h2'],
      ]),
      result.storyId,
    );
    expect(mockWriteDownloaded.mock.invocationCallOrder[1]).toBeLessThan(
      mockImportFullStory.mock.invocationCallOrder[0]!,
    );
  });

  it('gives every copy an id of its own', async () => {
    const first = await importStoryFromSource(db, 'user-1', { story, media: [] });
    const second = await importStoryFromSource(db, 'user-1', { story, media: [] });
    expect(first.storyId).not.toBe(second.storyId);
  });

  it('lets a failed import reach the caller', async () => {
    mockImportFullStory.mockRejectedValue(new Error('boom'));
    await expect(importStoryFromSource(db, 'user-1', { story, media: [] })).rejects.toThrow('boom');
  });
});

describe('importStoryZipBytes', () => {
  it('reads the package and imports what it holds', async () => {
    mockExtractStoryZip.mockResolvedValue({ story, media: [] });
    const bytes = new Uint8Array([80, 75]);

    const result = await importStoryZipBytes(db, 'user-1', bytes, 'casa.zip');

    expect(mockExtractStoryZip).toHaveBeenCalledWith(bytes, 'casa.zip');
    expect(result.title).toBe('Casa');
    expect(mockImportFullStory).toHaveBeenCalledTimes(1);
  });

  it('imports nothing from a package that cannot be read', async () => {
    mockExtractStoryZip.mockRejectedValue(new Error('not a zip'));
    await expect(importStoryZipBytes(db, 'user-1', new Uint8Array(), 'x.zip')).rejects.toThrow(
      'not a zip',
    );
    expect(mockImportFullStory).not.toHaveBeenCalled();
  });
});
