import { CURRENT_STORY_FORMAT_VERSION } from '@keres/shared';
import { File } from 'expo-file-system';
import JSZip from 'jszip';
import { mediaFileService } from '../../src/services/MediaFileService';
import {
  buildStoryZipBytes,
  extractStoryZip,
  stripUtf8Bom,
} from '../../src/utils/storyMediaBundle';
import { StoryImportError } from '../../src/utils/StoryImportError';

// `buildStoryZipBytes` lê arquivos do aparelho; só a leitura do pacote (`extractStoryZip`) é
// exercitada aqui, então o serviço de arquivos é neutralizado para o módulo poder ser importado.
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

async function buildZip(entries: Record<string, string | Uint8Array>): Promise<Uint8Array> {
  const zip = new JSZip();
  for (const [name, contents] of Object.entries(entries)) {
    zip.file(name, contents, { compression: 'STORE' });
  }
  return zip.generateAsync({ type: 'uint8array', compression: 'STORE' });
}

describe('stripUtf8Bom', () => {
  it('removes a leading UTF-8 BOM', () => {
    expect(stripUtf8Bom('﻿{"a":1}')).toBe('{"a":1}');
  });

  it('leaves text without a BOM untouched', () => {
    expect(stripUtf8Bom('{"a":1}')).toBe('{"a":1}');
    expect(stripUtf8Bom('')).toBe('');
  });

  it('only removes the BOM at the very start', () => {
    expect(stripUtf8Bom('{"a":"﻿"}')).toBe('{"a":"﻿"}');
  });
});

describe('buildStoryZipBytes', () => {
  beforeEach(() => jest.clearAllMocks());

  it('keeps the story JSON and includes only media available on this device', async () => {
    const includedHash = HASH;
    const absentHash = 'b'.repeat(32);
    mediaServiceMock.localPathFor.mockImplementation((_storyId, hash) => `file://media/${hash}`);
    mediaServiceMock.exists.mockImplementation((path) => (path ?? '').includes(includedHash));
    fileMock.mockImplementation((path: string) => ({
      bytes: jest
        .fn()
        .mockResolvedValue(new Uint8Array(path.includes(includedHash) ? [1, 2, 3] : [])),
    }));

    const result = await buildStoryZipBytes(
      storyJson({
        galleryItems: [galleryItem(includedHash), galleryItem(absentHash, 'image/jpeg')],
      }) as never,
      STORY_ID,
    );
    const zip = await JSZip.loadAsync(result.bytes);

    expect(result).toMatchObject({ includedCount: 1, totalCount: 2 });
    await expect(zip.file('story.json')!.async('string')).resolves.toContain('"A Queda"');
    expect(Array.from(await zip.file(`media/${includedHash}.png`)!.async('uint8array'))).toEqual([
      1, 2, 3,
    ]);
    expect(zip.file(`media/${absentHash}.jpg`)).toBeNull();
    expect(mediaServiceMock.localPathFor).toHaveBeenCalledWith(STORY_ID, includedHash, 'image/png');
  });

  it('creates a valid data-only ZIP when the export has no gallery field', async () => {
    const result = await buildStoryZipBytes(
      storyJson({ galleryItems: undefined }) as never,
      STORY_ID,
    );
    const zip = await JSZip.loadAsync(result.bytes);

    expect(result).toMatchObject({ includedCount: 0, totalCount: 0 });
    expect(zip.file('story.json')).not.toBeNull();
    expect(zip.file(/^media\//)).toEqual([]);
  });
});

describe('extractStoryZip', () => {
  it('reads back a package with no media', async () => {
    const bytes = await buildZip({ 'story.json': JSON.stringify(storyJson()) });

    const extracted = await extractStoryZip(bytes, 'a-queda.zip');

    expect(extracted.story.story.id).toBe(STORY_ID);
    expect(extracted.media).toEqual([]);
  });

  it('revives dates so the schema accepts a package this app exported', async () => {
    const bytes = await buildZip({
      'story.json': JSON.stringify(storyJson({ galleryItems: [galleryItem()] })),
    });

    const extracted = await extractStoryZip(bytes, 'a-queda.zip');

    expect(extracted.story.galleryItems![0].createdAt).toBeInstanceOf(Date);
  });

  it('extracts media bytes and takes the mime type from story.json, not the file extension', async () => {
    const bytes = await buildZip({
      'story.json': JSON.stringify(storyJson({ galleryItems: [galleryItem(HASH, 'image/heic')] })),
      [`media/${HASH}.bin`]: new Uint8Array([1, 2, 3]),
    });

    const extracted = await extractStoryZip(bytes, 'a-queda.zip');

    expect(extracted.media).toHaveLength(1);
    expect(extracted.media[0]).toMatchObject({ hash: HASH, mimeType: 'image/heic' });
    expect(Array.from(extracted.media[0].bytes)).toEqual([1, 2, 3]);
  });

  it('skips a media entry that story.json does not reference, instead of failing the import', async () => {
    const bytes = await buildZip({
      'story.json': JSON.stringify(storyJson({ galleryItems: [galleryItem()] })),
      [`media/${HASH}.png`]: new Uint8Array([1]),
      'media/deadbeef.png': new Uint8Array([9]),
    });

    const extracted = await extractStoryZip(bytes, 'a-queda.zip');

    expect(extracted.media.map((item) => item.hash)).toEqual([HASH]);
  });

  it('tolerates a BOM at the start of story.json', async () => {
    const bytes = await buildZip({ 'story.json': `﻿${JSON.stringify(storyJson())}` });

    await expect(extractStoryZip(bytes, 'a-queda.zip')).resolves.toBeDefined();
  });

  it('reports unreadable when the bytes are not a zip at all', async () => {
    const notAZip = new TextEncoder().encode('isto não é um zip');

    await expect(extractStoryZip(notAZip, 'a-queda.zip')).rejects.toMatchObject({
      name: 'StoryImportError',
      reason: 'unreadable',
    });
  });

  it('reports invalid_format when story.json is missing', async () => {
    const bytes = await buildZip({ 'leiame.txt': 'nada aqui' });

    await expect(extractStoryZip(bytes, 'a-queda.zip')).rejects.toMatchObject({
      reason: 'invalid_format',
    });
  });

  it('reports invalid_format when story.json is not valid JSON', async () => {
    const bytes = await buildZip({ 'story.json': '{ isto não é json' });

    await expect(extractStoryZip(bytes, 'a-queda.zip')).rejects.toMatchObject({
      reason: 'invalid_format',
    });
  });

  it('reports invalid_format when the JSON is valid but is not a Keres export', async () => {
    const bytes = await buildZip({ 'story.json': JSON.stringify({ hello: 'world' }) });

    await expect(extractStoryZip(bytes, 'a-queda.zip')).rejects.toMatchObject({
      reason: 'invalid_format',
    });
  });

  it('reports future_format_version for a package produced by a newer app', async () => {
    const bytes = await buildZip({
      'story.json': JSON.stringify(storyJson({ formatVersion: CURRENT_STORY_FORMAT_VERSION + 1 })),
    });

    await expect(extractStoryZip(bytes, 'a-queda.zip')).rejects.toMatchObject({
      reason: 'future_format_version',
    });
  });

  it('names the offending file in every failure message', async () => {
    const notAZip = new TextEncoder().encode('nope');

    await expect(extractStoryZip(notAZip, 'backup-2026.zip')).rejects.toThrow(/backup-2026\.zip/);
  });

  it('migrates a legacy V1 package forward instead of rejecting it', async () => {
    const legacy = { ...storyJson(), formatVersion: 1 };
    const bytes = await buildZip({ 'story.json': JSON.stringify(legacy) });

    const extracted = await extractStoryZip(bytes, 'a-queda.zip');

    expect(extracted.story.formatVersion).toBe(CURRENT_STORY_FORMAT_VERSION);
  });

  it('throws the error type the import screen switches on', async () => {
    const notAZip = new TextEncoder().encode('nope');

    await expect(extractStoryZip(notAZip, 'a.zip')).rejects.toBeInstanceOf(StoryImportError);
  });
});
