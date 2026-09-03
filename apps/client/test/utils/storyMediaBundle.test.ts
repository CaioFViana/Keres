import {
  CURRENT_STORY_FORMAT_VERSION,
  extractStoryZip as extractSharedStoryZip,
} from '@keres/shared';
import { File } from 'expo-file-system';
import { mediaFileService } from '../../src/services/MediaFileService';
import { StoryImportError } from '../../src/utils/StoryImportError';
import { buildStoryZipBytes, extractStoryZip } from '../../src/utils/storyMediaBundle';

jest.mock('../../src/services/MediaFileService', () => ({
  mediaFileService: { localPathFor: jest.fn(), exists: jest.fn(() => false) },
}));
jest.mock('expo-file-system', () => ({ File: jest.fn() }));

const fileMock = File as unknown as jest.Mock;
const mediaServiceMock = mediaFileService as jest.Mocked<typeof mediaFileService>;

const ulid = (suffix: string) => suffix.toUpperCase().padStart(26, '0');
const STORY_ID = ulid('story1');
const HASH = 'a'.repeat(32);
const REQUIRED_COLLECTIONS = [
  'chapters',
  'scenes',
  'choices',
  'characters',
  'locations',
  'worldRules',
  'notes',
  'noteRelations',
  'tags',
  'tagRelations',
  'suggestions',
  'characterRelations',
  'characterScenes',
  'galleryItems',
  'itemJourneys',
];

function storyJson(overrides: Record<string, unknown> = {}) {
  return {
    story: { id: STORY_ID, userId: ulid('user1'), title: 'A Queda', type: 'linear' },
    ...Object.fromEntries(REQUIRED_COLLECTIONS.map((name) => [name, []])),
    serverLastOperationVersion: 0,
    formatVersion: CURRENT_STORY_FORMAT_VERSION,
    ...overrides,
  };
}

function galleryItem(hash = HASH, mimeType = 'image/png') {
  const now = new Date('2026-08-11T18:00:00.000Z').toISOString();
  return {
    id: ulid('media1'),
    storyId: STORY_ID,
    mediaType: 'image',
    mimeType,
    fileName: 'retrato.png',
    hash,
    sizeBytes: 3,
    title: null,
    isFavorite: false,
    extraNotes: null,
    createdAt: now,
    updatedAt: now,
    version: 1,
    isDeleted: false,
    deletedAt: null,
  };
}

describe('buildStoryZipBytes', () => {
  beforeEach(() => jest.clearAllMocks());

  it('keeps the story JSON and includes only media available on this device', async () => {
    const absentHash = 'b'.repeat(32);
    mediaServiceMock.localPathFor.mockImplementation((_storyId, hash) => `file://media/${hash}`);
    mediaServiceMock.exists.mockImplementation((path) => (path ?? '').includes(HASH));
    fileMock.mockImplementation((path: string) => ({
      bytes: jest.fn().mockResolvedValue(new Uint8Array(path.includes(HASH) ? [1, 2, 3] : [])),
    }));

    const result = await buildStoryZipBytes(
      storyJson({ galleryItems: [galleryItem(), galleryItem(absentHash, 'image/jpeg')] }) as never,
      STORY_ID,
    );
    const extracted = await extractSharedStoryZip(result.bytes, 'a-queda.zip');

    expect(result).toMatchObject({ includedCount: 1, totalCount: 2 });
    expect(extracted.story.story.title).toBe('A Queda');
    expect(extracted.media).toHaveLength(1);
    expect(Array.from(extracted.media[0].bytes)).toEqual([1, 2, 3]);
    expect(mediaServiceMock.localPathFor).toHaveBeenCalledWith(STORY_ID, HASH, 'image/png');
  });

  it('creates a valid data-only ZIP when the export has no gallery field', async () => {
    const result = await buildStoryZipBytes(
      storyJson({ galleryItems: undefined }) as never,
      STORY_ID,
    );

    expect(result).toMatchObject({ includedCount: 0, totalCount: 0 });
    expect(result.bytes).not.toHaveLength(0);
  });
});

describe('extractStoryZip', () => {
  it('adapts a portable archive failure to the error the app presents', async () => {
    await expect(
      extractStoryZip(new TextEncoder().encode('not a zip'), 'a.zip'),
    ).rejects.toMatchObject({
      name: 'StoryImportError',
      reason: 'unreadable',
    } satisfies Partial<StoryImportError>);
  });
});
