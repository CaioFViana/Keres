/**
 * @jest-environment node
 */
import {
  captureImageThumbnail,
  IMAGE_THUMBNAIL_JPEG_QUALITY,
  IMAGE_THUMBNAIL_MAX_EDGE,
  IMAGE_THUMBNAIL_MIN_BYTES,
  wantsImageThumbnail,
} from '@/src/services/platform-web/webImageThumbnail';

type Globals = {
  createImageBitmap?: unknown;
  OffscreenCanvas?: unknown;
  document?: unknown;
};
const globals = globalThis as Globals;
const saved = {
  createImageBitmap: globals.createImageBitmap,
  OffscreenCanvas: globals.OffscreenCanvas,
  document: globals.document,
};

afterEach(() => {
  globals.createImageBitmap = saved.createImageBitmap;
  globals.OffscreenCanvas = saved.OffscreenCanvas;
  globals.document = saved.document;
});

const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]);

function stubBitmap(width: number, height: number) {
  const close = jest.fn();
  globals.createImageBitmap = jest.fn(async () => ({ width, height, close }));
  return close;
}

/** An `OffscreenCanvas` that records what was drawn and answers with a fixed JPEG. */
function stubOffscreen() {
  const calls = { sizes: [] as [number, number][], fills: 0, draws: [] as number[][], quality: 0 };
  globals.OffscreenCanvas = class {
    constructor(
      public width: number,
      public height: number,
    ) {
      calls.sizes.push([width, height]);
    }
    getContext() {
      return {
        fillStyle: '',
        fillRect: () => {
          calls.fills += 1;
        },
        drawImage: (_bitmap: unknown, ...args: number[]) => calls.draws.push(args),
      };
    }
    async convertToBlob(options: { type: string; quality: number }) {
      calls.quality = options.quality;
      return new Blob([JPEG as BlobPart], { type: options.type });
    }
  };
  return calls;
}

describe('wantsImageThumbnail', () => {
  it('asks for one for a big picture of a format a canvas redraws', () => {
    for (const type of ['image/jpeg', 'image/png', 'image/webp']) {
      expect(wantsImageThumbnail(type, IMAGE_THUMBNAIL_MIN_BYTES)).toBe(true);
    }
  });

  it('asks for none for a small file, nor for animated or vector pictures', () => {
    expect(wantsImageThumbnail('image/jpeg', IMAGE_THUMBNAIL_MIN_BYTES - 1)).toBe(false);
    for (const type of ['image/gif', 'image/svg+xml', 'image/avif', 'image/bmp', 'video/mp4']) {
      expect(wantsImageThumbnail(type, 50 * 1024 * 1024)).toBe(false);
    }
  });
});

describe('captureImageThumbnail', () => {
  it('scales a big picture down to the longest side, keeping its proportions, and answers JPEG bytes', async () => {
    const close = stubBitmap(4000, 3000);
    const canvas = stubOffscreen();

    const bytes = await captureImageThumbnail(new Blob(['x']));

    expect(bytes).toEqual(JPEG);
    expect(canvas.sizes).toEqual([[IMAGE_THUMBNAIL_MAX_EDGE, 480]]);
    expect(canvas.draws).toEqual([[0, 0, IMAGE_THUMBNAIL_MAX_EDGE, 480]]);
    expect(canvas.quality).toBe(IMAGE_THUMBNAIL_JPEG_QUALITY);
    // White underneath: a transparent PNG would come out black in a JPEG.
    expect(canvas.fills).toBe(1);
    // The full-size decode is released.
    expect(close).toHaveBeenCalledTimes(1);
  });

  it('scales by the longest side, tall or wide', async () => {
    stubBitmap(1000, 4000);
    const canvas = stubOffscreen();

    await captureImageThumbnail(new Blob(['x']));

    expect(canvas.sizes).toEqual([[160, IMAGE_THUMBNAIL_MAX_EDGE]]);
  });

  it('makes none for a picture that is small already: it is its own thumbnail', async () => {
    const close = stubBitmap(IMAGE_THUMBNAIL_MAX_EDGE, 300);
    const canvas = stubOffscreen();

    await expect(captureImageThumbnail(new Blob(['x']))).resolves.toBeUndefined();

    expect(canvas.sizes).toEqual([]);
    expect(close).toHaveBeenCalledTimes(1);
  });

  it('falls back to a canvas element where there is no OffscreenCanvas', async () => {
    stubBitmap(2000, 2000);
    globals.OffscreenCanvas = undefined;
    const toBlob = jest.fn((callback: (blob: Blob | null) => void, type: string) =>
      callback(new Blob([JPEG as BlobPart], { type })),
    );
    const canvas = {
      width: 0,
      height: 0,
      getContext: () => ({ fillStyle: '', fillRect: jest.fn(), drawImage: jest.fn() }),
      toBlob,
    };
    globals.document = { createElement: jest.fn(() => canvas) };

    const bytes = await captureImageThumbnail(new Blob(['x']));

    expect(bytes).toEqual(JPEG);
    expect([canvas.width, canvas.height]).toEqual([
      IMAGE_THUMBNAIL_MAX_EDGE,
      IMAGE_THUMBNAIL_MAX_EDGE,
    ]);
    expect(toBlob).toHaveBeenCalledWith(
      expect.any(Function),
      'image/jpeg',
      IMAGE_THUMBNAIL_JPEG_QUALITY,
    );
  });

  it('degrades to undefined: no decoder, an undecodable file, no canvas', async () => {
    globals.createImageBitmap = undefined;
    await expect(captureImageThumbnail(new Blob(['x']))).resolves.toBeUndefined();

    globals.createImageBitmap = jest.fn(async () => {
      throw new Error('not an image');
    });
    await expect(captureImageThumbnail(new Blob(['x']))).resolves.toBeUndefined();

    const close = stubBitmap(3000, 3000);
    globals.OffscreenCanvas = undefined;
    globals.document = undefined;
    await expect(captureImageThumbnail(new Blob(['x']))).resolves.toBeUndefined();
    expect(close).toHaveBeenCalledTimes(1);
  });
});
