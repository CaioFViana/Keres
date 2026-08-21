import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';
import type { FullStoryExportType } from '../../schemas/FullStorySchemas';
import type { GalleryType } from '../../schemas/GallerySchemas';
import { buildStoryZipBytes, MEDIA_DIR_PREFIX, STORY_JSON_ENTRY } from '../../utils/storyZip';

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
    // 4 KB de zeros: DEFLATE reduziria isso a quase nada, STORE não reduz. O tamanho final do
    // pacote é o que separa os dois casos sem depender de detalhes internos do JSZip.
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
