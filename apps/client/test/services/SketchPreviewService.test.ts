/**
 * @jest-environment node
 */
import { emptySketchContent } from '@keres/shared';
import {
  createSketchPreviewService,
  SKETCH_PREVIEW_PRINT_LOOK,
  sketchPreviewKey,
  type SketchPreviewStore,
} from '../../src/services/storymanagement/SketchPreviewService';

jest.mock('expo-file-system', () => ({
  Directory: class {},
  File: class {},
  Paths: { cache: '' },
}));

const mockRasterize = jest.fn();

jest.mock('../../src/utils/svgRaster', () => ({
  __esModule: true,
  fitRasterSize: (width: number, height: number) => ({ width, height }),
  rasterizeMapSvg: (...args: unknown[]) => mockRasterize(...args),
}));

function memoryStore() {
  const files = new Map<string, Uint8Array>();
  const pruned: number[] = [];
  const store: SketchPreviewStore = {
    find: async (key) => (files.has(key) ? `mem://${key}.png` : null),
    put: async (key, bytes) => {
      files.set(key, bytes);
      return `mem://${key}.png`;
    },
    read: async (uri) => {
      const key = uri.replace('mem://', '').replace(/\.png$/, '');
      return files.get(key) ?? null;
    },
    prune: async (max) => {
      pruned.push(max);
    },
  };
  return { store, files, pruned };
}

const content = () =>
  emptySketchContent('AAAAAAAA', 'Layer 1', { width: 200, height: 200, preset: null });

const look = SKETCH_PREVIEW_PRINT_LOOK;
const darkLook = {
  colors: { ...SKETCH_PREVIEW_PRINT_LOOK.colors, background: '#000000', text: '#ffffff' },
  paper: '#111111',
};

beforeEach(() => {
  mockRasterize.mockResolvedValue(new Uint8Array([1, 2, 3]));
  jest.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
  mockRasterize.mockReset();
});

describe('sketchPreviewKey', () => {
  it('is the same for the same drawing and look, and follows both', () => {
    const base = sketchPreviewKey(content(), look);

    expect(sketchPreviewKey(content(), look)).toBe(base);
    const changed = structuredClone(content());
    changed.page.width += 100;
    expect(sketchPreviewKey(changed, look)).not.toBe(base);
    expect(sketchPreviewKey(content(), darkLook)).not.toBe(base);
    expect(sketchPreviewKey(content(), { ...look, paper: '#000000' })).not.toBe(base);
  });
});

describe('createSketchPreviewService', () => {
  it('renders on a miss and reuses the file without rendering again', async () => {
    const kept = memoryStore();
    const service = createSketchPreviewService({ store: kept.store });

    const first = await service.ensure('Throne room', content(), look);

    expect(first.cached).toBe(false);
    expect(first.bytes).toEqual(new Uint8Array([1, 2, 3]));
    expect(first.uri).toMatch(/^mem:\/\//);
    expect(mockRasterize).toHaveBeenCalledTimes(1);

    const second = await service.ensure('Throne room', content(), look);

    expect(second).toEqual({ uri: first.uri, bytes: null, cached: true });
    expect(mockRasterize).toHaveBeenCalledTimes(1);
    expect(kept.pruned).toEqual([30 * 1024 * 1024]);
  });

  it('draws again under another theme instead of reusing the old look', async () => {
    const kept = memoryStore();
    const service = createSketchPreviewService({ store: kept.store });

    const light = await service.ensure('Throne room', content(), look);
    const dark = await service.ensure('Throne room', content(), darkLook);

    expect(dark.uri).not.toBe(light.uri);
    expect(mockRasterize).toHaveBeenCalledTimes(2);
    expect(kept.files.size).toBe(2);
  });

  it('shares one file between sketches with the same drawing', async () => {
    const kept = memoryStore();
    const service = createSketchPreviewService({ store: kept.store });

    const a = await service.ensure('First', content(), look);
    const b = await service.ensure('Second', content(), look);

    expect(b.uri).toBe(a.uri);
    expect(mockRasterize).toHaveBeenCalledTimes(1);
  });

  it('reads back the bytes behind an address it made', async () => {
    const kept = memoryStore();
    const service = createSketchPreviewService({ store: kept.store });

    const made = await service.ensure('Throne room', content(), look);

    expect(await service.readBytes(made.uri)).toEqual(new Uint8Array([1, 2, 3]));
    expect(await service.readBytes('mem://missing.png')).toBeNull();
  });
});
