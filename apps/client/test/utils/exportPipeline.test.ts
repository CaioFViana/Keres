/** @jest-environment jsdom */
jest.mock('expo-document-picker', () => ({ getDocumentAsync: jest.fn() }));
jest.mock('expo-file-system', () => ({
  File: jest.fn(),
  Paths: { cache: 'cache' },
}));
jest.mock('expo-sharing', () => ({ isAvailableAsync: jest.fn(), shareAsync: jest.fn() }));
jest.mock('react-native', () => ({ Platform: { OS: 'web' } }));
jest.mock('../../src/services/MediaFileService', () => ({
  __esModule: true,
  mediaFileService: { readBytes: jest.fn() },
}));
jest.mock('../../src/utils/storyMediaBundle', () => ({
  extractStoryZip: jest.fn(),
}));

import { Platform } from 'react-native';
import { mediaFileService } from '../../src/services/MediaFileService';
import {
  buildStandaloneBoardSvg,
  buildStandaloneLocationMapSvg,
} from '../../src/utils/storyMapSvgExport';
import { deliverMapExport } from '../../src/utils/storyTransfer';
import { parseSvgRootSize } from '../../src/utils/svgRaster';

const readBytesMock = mediaFileService.readBytes as jest.Mock;

const COLORS = {
  background: '#000000',
  surface: '#111111',
  text: '#ffffff',
  textSecondary: '#aaaaaa',
  border: '#444444',
  primary: '#8855ff',
};

const PNG_BYTES = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10]);
const JPEG_BYTES = Uint8Array.from([255, 216, 255, 224]);

beforeEach(() => {
  jest.clearAllMocks();
  Platform.OS = 'web';
});

// Mirrors the delivery suite: the browser download path needs page-level APIs stubbed.
function stubBrowserDownload() {
  const anchor = document.createElement('a');
  const click = jest.spyOn(anchor, 'click').mockImplementation(() => {});
  const createElement = jest.spyOn(document, 'createElement').mockReturnValue(anchor);
  Object.defineProperty(URL, 'createObjectURL', {
    configurable: true,
    value: jest.fn(() => 'blob:map'),
  });
  Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: jest.fn() });
  return { anchor, click, createElement };
}

function restoreDownloadStubs(stubs: { click: jest.SpyInstance; createElement: jest.SpyInstance }) {
  stubs.createElement.mockRestore();
  stubs.click.mockRestore();
}

describe('location map export pipeline', () => {
  const content = {
    images: [
      { id: 'img1', galleryId: 'gal1', x: 10, y: 20, width: 400, height: 300, locked: false },
    ],
    nodes: [
      { id: 'n1', locationId: 'loc1', x: 100, y: 100, icon: 'map', color: '#ff0000' },
      { id: 'n2', locationId: 'loc2', x: 300, y: 220, icon: 'xxx-unknown', color: '#00ff00' },
    ],
    markers: [],
  } as never;
  const options = {
    title: 'Mapa',
    subtitle: '2 locais, 1 imagem',
    colors: COLORS,
    nodeNames: { loc1: 'Reino & Cidade', loc2: 'Porto' },
    connections: [{ locationAId: 'loc1', locationBId: 'loc2', label: 'trilha' }],
    contains: [{ parentLocationId: 'loc1', childLocationId: 'loc2' }],
  } as never;

  beforeEach(() => {
    readBytesMock.mockResolvedValue(PNG_BYTES);
  });

  it('builds a standalone SVG with embedded images, relations and escaped names', async () => {
    const svg = await buildStandaloneLocationMapSvg(
      content,
      { gal1: { mediaType: 'image', mimeType: 'image/png', localPath: 'gal1.png' } },
      options,
    );

    expect(readBytesMock).toHaveBeenCalledWith('gal1.png');
    expect(svg).toContain('data:image/png;base64,');
    expect(svg).toContain('Reino &amp; Cidade');
    expect(svg).toContain('trilha');
    expect(svg).toContain('<polygon');
    const size = parseSvgRootSize(svg);
    expect(size).not.toBeNull();
    expect(size!.width).toBeGreaterThan(0);
    expect(size!.height).toBeGreaterThan(0);
  });

  it('keeps a placeholder and a parseable document when an image cannot be read', async () => {
    const log = jest.spyOn(console, 'log').mockImplementation(() => {});
    readBytesMock.mockRejectedValue(new Error('unavailable'));

    const svg = await buildStandaloneLocationMapSvg(
      content,
      { gal1: { mediaType: 'image', mimeType: 'image/png', localPath: 'gal1.png' } },
      options,
    );

    expect(svg).not.toContain('data:');
    expect(parseSvgRootSize(svg)).not.toBeNull();
    expect(log).toHaveBeenCalled();
    log.mockRestore();
  });

  it('delivers the same string untouched in svg mode', async () => {
    const stubs = stubBrowserDownload();
    const rasterize = jest.fn();
    const svg = await buildStandaloneLocationMapSvg(
      content,
      { gal1: { mediaType: 'image', mimeType: 'image/png', localPath: 'gal1.png' } },
      options,
    );

    await expect(deliverMapExport(svg, 'mapa.svg', 'svg', rasterize)).resolves.toEqual({
      delivered: true,
      fileName: 'mapa.svg',
    });
    expect(rasterize).not.toHaveBeenCalled();
    expect(stubs.anchor.download).toBe('mapa.svg');
    expect(stubs.click).toHaveBeenCalledTimes(1);
    restoreDownloadStubs(stubs);
  });

  it('rasterizes the sanitized string at the parsed size in png mode', async () => {
    const stubs = stubBrowserDownload();
    const rasterize = jest.fn(
      async (_svg: string, _width: number, _height: number): Promise<Uint8Array> => PNG_BYTES,
    );
    const svg = await buildStandaloneLocationMapSvg(
      content,
      { gal1: { mediaType: 'image', mimeType: 'image/png', localPath: 'gal1.png' } },
      options,
    );
    const size = parseSvgRootSize(svg)!;

    await expect(deliverMapExport(svg, 'mapa.svg', 'png', rasterize)).resolves.toEqual({
      delivered: true,
      fileName: 'mapa.png',
    });
    expect(rasterize).toHaveBeenCalledTimes(1);
    const [rasterSvg, width, height] = rasterize.mock.calls[0];
    expect(rasterSvg).toContain('font-family="sans-serif"');
    expect(rasterSvg).not.toContain('Helvetica, Arial');
    expect(width).toBe(size.width);
    expect(height).toBe(size.height);
    expect(stubs.anchor.download).toBe('mapa.png');
    expect(stubs.click).toHaveBeenCalledTimes(1);
    restoreDownloadStubs(stubs);
  });
});

describe('board export pipeline', () => {
  const content = {
    nodes: [
      { id: 'g', kind: 'entity', entityType: 'Gallery', entityId: 'gal1', x: 0, y: 0 },
      { id: 'n', kind: 'note', title: 'Nota', body: 'corpo da nota', x: 500, y: 100 },
    ],
    edges: [{ id: 'e1', from: 'g', to: 'n', directed: true, label: 'ver também' }],
  } as never;
  const options = {
    title: 'Quadro',
    subtitle: '2 pins',
    colors: COLORS,
    titles: {
      g: { title: 'Foto', typeLabel: 'Gallery' },
      n: { title: 'Nota', typeLabel: 'note' },
    },
    galleryMediaById: {
      gal1: {
        mediaType: 'image',
        mimeType: 'image/jpeg',
        localPath: 'gal1.jpg',
        thumbnailPath: null,
      },
    },
    summaries: {},
  } as Parameters<typeof buildStandaloneBoardSvg>[1];

  beforeEach(() => {
    readBytesMock.mockResolvedValue(JPEG_BYTES);
  });

  it('builds a standalone SVG with embedded pictures and edge labels', async () => {
    const svg = await buildStandaloneBoardSvg(content, options);

    expect(readBytesMock).toHaveBeenCalledWith('gal1.jpg');
    expect(svg).toContain('data:image/jpeg;base64,');
    expect(svg).toContain('ver também');
    const size = parseSvgRootSize(svg);
    expect(size).not.toBeNull();
    expect(size!.width).toBeGreaterThan(0);
    expect(size!.height).toBeGreaterThan(0);
  });

  it('embeds video thumbnails as jpeg data URIs', async () => {
    const svg = await buildStandaloneBoardSvg(content, {
      ...options,
      galleryMediaById: {
        gal1: {
          mediaType: 'video',
          mimeType: 'video/mp4',
          localPath: 'clip.mp4',
          thumbnailPath: 'thumb.jpg',
        },
      },
    } as never);

    expect(readBytesMock).toHaveBeenCalledWith('thumb.jpg');
    expect(svg).toContain('data:image/jpeg;base64,');
  });

  it('delivers svg untouched and png rasterized from the sanitized string', async () => {
    const svgStubs = stubBrowserDownload();
    const svgRasterize = jest.fn();
    const svg = await buildStandaloneBoardSvg(content, options);

    await expect(deliverMapExport(svg, 'quadro.svg', 'svg', svgRasterize)).resolves.toEqual({
      delivered: true,
      fileName: 'quadro.svg',
    });
    expect(svgRasterize).not.toHaveBeenCalled();
    expect(svgStubs.anchor.download).toBe('quadro.svg');
    restoreDownloadStubs(svgStubs);

    const pngStubs = stubBrowserDownload();
    const pngRasterize = jest.fn(
      async (_svg: string, _width: number, _height: number): Promise<Uint8Array> => PNG_BYTES,
    );
    const size = parseSvgRootSize(svg)!;
    await expect(deliverMapExport(svg, 'quadro.svg', 'png', pngRasterize)).resolves.toEqual({
      delivered: true,
      fileName: 'quadro.png',
    });
    const [rasterSvg, width, height] = pngRasterize.mock.calls[0];
    expect(rasterSvg).toContain('font-family="sans-serif"');
    expect(rasterSvg).not.toContain('Helvetica, Arial');
    expect(width).toBe(size.width);
    expect(height).toBe(size.height);
    expect(pngStubs.anchor.download).toBe('quadro.png');
    restoreDownloadStubs(pngStubs);
  });
});
