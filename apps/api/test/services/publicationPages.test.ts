import type { CompileStoryReaderInput, FullStoryExportType } from '@keres/shared';
import { MAX_MANUSCRIPT_BYTES } from '@keres/shared';
import { describe, expect, it, vi } from 'vitest';
import { staleSketchPages, withScenePages } from '../../src/services/publicationPages';

/** The header of a PNG: its size is all the pipeline reads before handing the bytes on. */
function pngHeader(width: number, height: number): Uint8Array {
  const u32 = (value: number) => [
    value >>> 24,
    (value >>> 16) & 255,
    (value >>> 8) & 255,
    value & 255,
  ];
  return Uint8Array.from([
    0x89,
    0x50,
    0x4e,
    0x47,
    0x0d,
    0x0a,
    0x1a,
    0x0a,
    ...u32(13),
    0x49,
    0x48,
    0x44,
    0x52,
    ...u32(width),
    ...u32(height),
    8,
    6,
    0,
    0,
    0,
  ]);
}

const base: CompileStoryReaderInput = {
  storyTitle: 'T',
  storyType: 'linear',
  chapters: [
    { id: 'c1', name: 'One', index: 1, type: 'chapter', arcId: 'arc-1' },
    { id: 'c2', name: 'Two', index: 2, type: 'chapter', arcId: 'arc-2' },
  ],
  scenes: [
    { id: 's1', chapterId: 'c1', name: 'S1', index: 1, body: 'x', isDeleted: false },
    { id: 's2', chapterId: 'c2', name: 'S2', index: 1, body: 'y', isDeleted: false },
  ],
  choices: [],
};

const page = (id: string, sceneId: string, rank: string, extra: Record<string, unknown> = {}) => ({
  id,
  storyId: 'st',
  sceneId,
  rank,
  sketchId: null,
  galleryId: null,
  fit: 'contain',
  text: `text ${id}`,
  isDeleted: false,
  ...extra,
});

const gallery = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  mediaType: 'image',
  hash: `hash-${id}`,
  sizeBytes: 100,
  isDeleted: false,
  ...extra,
});

function exportOf(parts: Record<string, unknown>): FullStoryExportType {
  return { galleryItems: [], storySketches: [], scenePages: [], ...parts } as never;
}

describe('withScenePages', () => {
  it('hands the input back untouched when the story has no pages', async () => {
    const readMedia = vi.fn();

    const result = await withScenePages(base, exportOf({}), { format: 'pdf' }, readMedia);

    expect(result).toBe(base);
    expect(readMedia).not.toHaveBeenCalled();
  });

  it("gives each scene its pages in rank order, with the picture of a Gallery image and of a Sketch's snapshot", async () => {
    const storyExport = exportOf({
      galleryItems: [gallery('g1'), gallery('g2')],
      storySketches: [{ id: 'sk1', coverGalleryId: 'g2', isDeleted: false }],
      scenePages: [
        page('p2', 's1', 'a1', { sketchId: 'sk1' }),
        page('p1', 's1', 'a0', { galleryId: 'g1' }),
      ],
    });
    const readMedia = vi.fn(async () => pngHeader(30, 40));

    const result = await withScenePages(base, storyExport, { format: 'html' }, readMedia);

    expect(result.scenes[0].pages?.map((p) => [p.id, p.mediaId, p.text])).toEqual([
      ['p1', 'g1', 'text p1'],
      ['p2', 'g2', 'text p2'],
    ]);
    expect(result.scenes[1].pages).toBeUndefined();
    expect(Object.keys(result.media ?? {}).sort()).toEqual(['g1', 'g2']);
    expect(result.media?.g1).toMatchObject({ mimeType: 'image/png', width: 30, height: 40 });
    expect(readMedia).toHaveBeenCalledWith('hash-g1');
  });

  it('reads a picture once however many pages use it', async () => {
    const storyExport = exportOf({
      galleryItems: [gallery('g1')],
      scenePages: [
        page('p1', 's1', 'a0', { galleryId: 'g1' }),
        page('p2', 's1', 'a1', { galleryId: 'g1' }),
      ],
    });
    const readMedia = vi.fn(async () => pngHeader(2, 2));

    await withScenePages(base, storyExport, { format: 'pdf' }, readMedia);

    expect(readMedia).toHaveBeenCalledTimes(1);
  });

  it('reads only the pictures of the arc asked for', async () => {
    const storyExport = exportOf({
      galleryItems: [gallery('g1'), gallery('g2')],
      scenePages: [
        page('p1', 's1', 'a0', { galleryId: 'g1' }),
        page('p2', 's2', 'a0', { galleryId: 'g2' }),
      ],
    });
    const readMedia = vi.fn(async () => pngHeader(2, 2));

    const result = await withScenePages(
      base,
      storyExport,
      { format: 'pdf', arcId: 'arc-2' },
      readMedia,
    );

    expect(readMedia).toHaveBeenCalledTimes(1);
    expect(readMedia).toHaveBeenCalledWith('hash-g2');
    expect(result.scenes[0].pages).toBeUndefined();
    expect(result.scenes[1].pages?.[0].mediaId).toBe('g2');
  });

  it('leaves a page without a picture when its image is gone, not an image, not on the server or too large', async () => {
    const storyExport = exportOf({
      galleryItems: [
        gallery('deleted', { isDeleted: true }),
        gallery('video', { mediaType: 'video' }),
        gallery('absent'),
        gallery('gif'),
        gallery('huge'),
      ],
      scenePages: [
        page('a', 's1', 'a0', { galleryId: 'deleted' }),
        page('b', 's1', 'a1', { galleryId: 'video' }),
        page('c', 's1', 'a2', { galleryId: 'absent' }),
        page('d', 's1', 'a3', { galleryId: 'gif' }),
        page('e', 's1', 'a4', { galleryId: 'huge' }),
        page('f', 's1', 'a5', { sketchId: 'sk-none' }),
        page('g', 's1', 'a6'),
      ],
    });
    const readMedia = vi.fn(async (hash: string) => {
      if (hash === 'hash-absent') return null;
      if (hash === 'hash-gif') return new TextEncoder().encode('GIF89a..........');
      return pngHeader(10_000, 10_000);
    });

    const result = await withScenePages(base, storyExport, { format: 'pdf' }, readMedia);

    expect(result.scenes[0].pages?.map((p) => p.mediaId)).toEqual([
      null,
      null,
      null,
      null,
      null,
      null,
      null,
    ]);
    expect(result.scenes[0].pages?.map((p) => p.text)).toContain('text e');
    expect(result.media).toEqual({});
  });

  it('survives a storage error as a missing picture', async () => {
    const storyExport = exportOf({
      galleryItems: [gallery('g1')],
      scenePages: [page('p1', 's1', 'a0', { galleryId: 'g1' })],
    });

    const result = await withScenePages(base, storyExport, { format: 'pdf' }, async () => {
      throw new Error('S3 down');
    });

    expect(result.scenes[0].pages?.[0]).toMatchObject({ mediaId: null, text: 'text p1' });
  });

  it('reads nothing for a format that has no pictures, and still carries the pages', async () => {
    const storyExport = exportOf({
      galleryItems: [gallery('g1')],
      scenePages: [page('p1', 's1', 'a0', { galleryId: 'g1' })],
    });
    const readMedia = vi.fn();

    const result = await withScenePages(base, storyExport, { format: 'md' }, readMedia);

    expect(readMedia).not.toHaveBeenCalled();
    expect(result.media).toBeUndefined();
    expect(result.scenes[0].pages?.[0]).toMatchObject({ mediaId: 'g1', text: 'text p1' });
  });

  it("refuses a book that cannot fit before it reads a single picture, in the compilers' words", async () => {
    const storyExport = exportOf({
      galleryItems: [gallery('g1', { sizeBytes: MAX_MANUSCRIPT_BYTES })],
      scenePages: [page('p1', 's1', 'a0', { galleryId: 'g1' })],
    });
    const readMedia = vi.fn();

    await expect(withScenePages(base, storyExport, { format: 'epub' }, readMedia)).rejects.toThrow(
      /exceeds the .* limit/,
    );
    expect(readMedia).not.toHaveBeenCalled();
  });

  it('drops the pages of a deleted scene and ignores deleted pages', async () => {
    const storyExport = exportOf({
      galleryItems: [gallery('g1')],
      scenePages: [
        page('live', 's1', 'a0', { galleryId: 'g1' }),
        page('gone', 's1', 'a1', { galleryId: 'g1', isDeleted: true }),
      ],
    });

    const result = await withScenePages(
      { ...base, scenes: [{ ...base.scenes[0], isDeleted: true }, base.scenes[1]] },
      storyExport,
      { format: 'html' },
      async () => pngHeader(2, 2),
    );

    expect(result.scenes[0].pages).toBeUndefined();
  });
});

describe('staleSketchPages', () => {
  const content = { page: { width: 10, height: 10 }, layers: [], overlays: [] };

  it('counts the sketch pages whose snapshot no longer shows the drawing', () => {
    const storyExport = exportOf({
      storySketches: [
        { id: 'old', coverGalleryId: 'g', coverSourceHash: null, content, isDeleted: false },
        { id: 'none', coverGalleryId: null, coverSourceHash: null, content, isDeleted: false },
      ],
      scenePages: [
        page('p1', 's1', 'a0', { sketchId: 'old' }),
        page('p2', 's1', 'a1', { sketchId: 'none' }),
        page('p3', 's1', 'a2', { galleryId: 'g' }),
        page('p4', 's1', 'a3', { sketchId: 'old', isDeleted: true }),
      ],
    });

    expect(staleSketchPages(storyExport)).toBe(2);
  });
});
