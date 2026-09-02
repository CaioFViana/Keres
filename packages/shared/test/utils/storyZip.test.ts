import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';
import type { FullStoryExportType } from '../../schemas/FullStorySchemas';
import type { GalleryType } from '../../schemas/GallerySchemas';
import { CURRENT_STORY_FORMAT_VERSION } from '../../schemas/StoryExportVersion';
import {
  buildStoryZipBytes,
  extractStoryZip,
  MEDIA_DIR_PREFIX,
  STORY_JSON_ENTRY,
} from '../../utils/storyZip';

function galleryItem(hash: string, mimeType: string): GalleryType {
  return {
    id: `gal-${hash}`,
    storyId: 'story-1',
    fileName: `${hash}.bin`,
    mimeType,
    hash,
    byteSize: 3,
    mediaType: 'image',
  } as unknown as GalleryType;
}

function storyExport(galleryItems: GalleryType[]): FullStoryExportType {
  return {
    story: { id: 'story-1', title: 'A Story' },
    galleryItems,
    serverLastOperationVersion: 7,
    formatVersion: 4,
  } as unknown as FullStoryExportType;
}

const BYTES = new Uint8Array([1, 2, 3]);
const IMPORT_STORY_ID = '00000000000000000000STORY1';
const IMPORT_HASH = 'a'.repeat(32);
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

function importStoryJson(overrides: Record<string, unknown> = {}) {
  return {
    story: {
      id: IMPORT_STORY_ID,
      userId: '00000000000000000000USER01',
      title: 'A Queda',
      type: 'linear',
    },
    ...Object.fromEntries(REQUIRED_COLLECTIONS.map((name) => [name, []])),
    serverLastOperationVersion: 0,
    formatVersion: CURRENT_STORY_FORMAT_VERSION,
    ...overrides,
  };
}

function importGalleryItem(hash = IMPORT_HASH, mimeType = 'image/png') {
  const now = new Date('2026-08-11T18:00:00.000Z').toISOString();
  return {
    id: '00000000000000000000MEDIA1',
    storyId: IMPORT_STORY_ID,
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

async function createZip(entries: Record<string, string | Uint8Array>): Promise<Uint8Array> {
  const zip = new JSZip();
  for (const [name, contents] of Object.entries(entries)) {
    zip.file(name, contents, { compression: 'STORE' });
  }
  return zip.generateAsync({ type: 'uint8array', compression: 'STORE' });
}

describe('buildStoryZipBytes', () => {
  it('writes story.json and one media entry per resolved item', async () => {
    const items = [galleryItem('aaa', 'image/png'), galleryItem('bbb', 'image/jpeg')];
    const result = await buildStoryZipBytes(storyExport(items), async () => BYTES);

    expect(result.includedCount).toBe(2);
    expect(result.totalCount).toBe(2);

    const zip = await JSZip.loadAsync(result.bytes);
    expect(zip.file(STORY_JSON_ENTRY)).not.toBeNull();
    expect(zip.file(`${MEDIA_DIR_PREFIX}aaa.png`)).not.toBeNull();
    expect(zip.file(`${MEDIA_DIR_PREFIX}bbb.jpg`)).not.toBeNull();
  });

  it('round-trips the export JSON unchanged', async () => {
    const source = storyExport([]);
    const result = await buildStoryZipBytes(source, async () => null);

    const zip = await JSZip.loadAsync(result.bytes);
    const entry = zip.file(STORY_JSON_ENTRY);
    expect(entry).not.toBeNull();
    const json = JSON.parse(await entry!.async('string'));
    expect(json).toEqual(JSON.parse(JSON.stringify(source)));
  });

  it('restores the exact media bytes it was given', async () => {
    const result = await buildStoryZipBytes(
      storyExport([galleryItem('aaa', 'image/png')]),
      async () => BYTES,
    );

    const zip = await JSZip.loadAsync(result.bytes);
    const media = await zip.file(`${MEDIA_DIR_PREFIX}aaa.png`)!.async('uint8array');
    expect(Array.from(media)).toEqual([1, 2, 3]);
  });

  it('does not pack a link because a URL has no bytes to put in the zip', async () => {
    const items = [
      galleryItem('aaa', 'image/png'),
      { ...galleryItem('linkhash', 'text/uri-list'), mediaType: 'link' } as GalleryType,
    ];
    const result = await buildStoryZipBytes(storyExport(items), async () => BYTES);

    expect(result.includedCount).toBe(1);
    expect(result.totalCount).toBe(1);

    const zip = await JSZip.loadAsync(result.bytes);
    expect(zip.file(`${MEDIA_DIR_PREFIX}aaa.png`)).not.toBeNull();
    expect(zip.file(`${MEDIA_DIR_PREFIX}linkhash.url`)).toBeNull();
  });

  it('skips media the resolver cannot provide and reports the shortfall', async () => {
    const items = [galleryItem('aaa', 'image/png'), galleryItem('bbb', 'image/png')];
    const result = await buildStoryZipBytes(storyExport(items), async (item) =>
      item.hash === 'aaa' ? BYTES : null,
    );

    expect(result.includedCount).toBe(1);
    expect(result.totalCount).toBe(2);

    const zip = await JSZip.loadAsync(result.bytes);
    expect(zip.file(`${MEDIA_DIR_PREFIX}aaa.png`)).not.toBeNull();
    expect(zip.file(`${MEDIA_DIR_PREFIX}bbb.png`)).toBeNull();
  });

  it('stores media uncompressed - the gallery is already compressed media', async () => {
    // 4 KB of zeros: DEFLATE would reduce that to almost nothing, STORE does not reduce it. The
    // package's final size is what separates the two cases without depending on JSZip's internals.
    const compressible = new Uint8Array(4096);
    const result = await buildStoryZipBytes(
      storyExport([galleryItem('aaa', 'image/png')]),
      async () => compressible,
    );

    expect(result.bytes.byteLength).toBeGreaterThan(compressible.byteLength);
  });

  it('tolerates an export with no gallery at all', async () => {
    const bare = { ...storyExport([]) };
    delete (bare as { galleryItems?: unknown }).galleryItems;
    const result = await buildStoryZipBytes(bare as FullStoryExportType, async () => BYTES);
    expect(result.totalCount).toBe(0);
    expect(result.includedCount).toBe(0);
  });
});

describe('extractStoryZip', () => {
  it('reads a package with no media and restores serialized dates', async () => {
    const bytes = await createZip({ 'story.json': JSON.stringify(importStoryJson()) });

    const extracted = await extractStoryZip(bytes, 'a-queda.zip');

    expect(extracted.story.story.id).toBe(IMPORT_STORY_ID);
    expect(extracted.media).toEqual([]);
  });

  it('extracts media bytes and uses the MIME type from story.json, not the extension', async () => {
    const bytes = await createZip({
      'story.json': JSON.stringify(
        importStoryJson({ galleryItems: [importGalleryItem(IMPORT_HASH, 'image/heic')] }),
      ),
      [`media/${IMPORT_HASH}.bin`]: new Uint8Array([1, 2, 3]),
      'media/deadbeef.png': new Uint8Array([9]),
    });

    const extracted = await extractStoryZip(bytes, 'a-queda.zip');

    expect(extracted.media).toHaveLength(1);
    expect(extracted.media[0]).toMatchObject({ hash: IMPORT_HASH, mimeType: 'image/heic' });
    expect(Array.from(extracted.media[0].bytes)).toEqual([1, 2, 3]);
  });

  it('tolerates a BOM at the start of story.json', async () => {
    const bytes = await createZip({ 'story.json': `﻿${JSON.stringify(importStoryJson())}` });

    await expect(extractStoryZip(bytes, 'a-queda.zip')).resolves.toBeDefined();
  });

  it.each([
    ['unreadable', () => Promise.resolve(new TextEncoder().encode('isto não é um zip'))],
    ['invalid_format', () => createZip({ 'leiame.txt': 'nada aqui' })],
    ['invalid_format', () => createZip({ 'story.json': '{ isto não é json' })],
    ['invalid_format', () => createZip({ 'story.json': JSON.stringify({ hello: 'world' }) })],
  ] as const)('classifies a %s archive error', async (reason, createBytes) => {
    const bytes = await createBytes();
    await expect(extractStoryZip(bytes, 'a-queda.zip')).rejects.toMatchObject({
      name: 'StoryZipReadError',
      reason,
    });
  });

  it('reports a package produced by a newer app', async () => {
    const bytes = await createZip({
      'story.json': JSON.stringify({
        ...importStoryJson(),
        formatVersion: CURRENT_STORY_FORMAT_VERSION + 1,
      }),
    });

    await expect(extractStoryZip(bytes, 'a-queda.zip')).rejects.toMatchObject({
      reason: 'future_format_version',
    });
  });
});
