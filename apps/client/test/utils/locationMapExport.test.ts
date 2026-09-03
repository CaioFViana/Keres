jest.mock('../../src/services/MediaFileService', () => ({
  __esModule: true,
  mediaFileService: { readBytes: jest.fn() },
}));
jest.mock('../../src/utils/locationMapSvg', () => ({
  __esModule: true,
  renderLocationMapSvg: jest.fn(() => '<svg />'),
}));

import { mediaFileService } from '../../src/services/MediaFileService';
import { buildLocationMapSvg } from '../../src/utils/locationMapExport';
import { renderLocationMapSvg } from '../../src/utils/locationMapSvg';

const content = {
  nodes: [],
  connections: [],
  contains: [],
  images: [
    { id: 'valid-image', galleryId: 'valid' },
    { id: 'not-an-image', galleryId: 'document' },
    { id: 'missing-file', galleryId: 'missing' },
    { id: 'unreadable', galleryId: 'broken' },
  ],
} as never;
const options = {
  title: 'Map',
  subtitle: '',
  colors: { background: '', surface: '', text: '', textSecondary: '', border: '' },
  nodeNames: {},
  connections: [],
  contains: [],
};

beforeEach(() => {
  jest.clearAllMocks();
  (mediaFileService.readBytes as jest.Mock).mockImplementation((path: string) => {
    if (path === 'broken') return Promise.reject(new Error('unavailable'));
    return Promise.resolve(new Uint8Array([72, 105]));
  });
  jest.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(() => jest.restoreAllMocks());

describe('buildLocationMapSvg', () => {
  it('embeds readable image media and keeps placeholders for invalid or unreadable entries', async () => {
    await expect(
      buildLocationMapSvg(
        content,
        {
          valid: { mediaType: 'image', mimeType: 'image/png', localPath: 'valid' },
          document: { mediaType: 'document', mimeType: 'application/pdf', localPath: 'document' },
          missing: { mediaType: 'image', mimeType: 'image/png', localPath: null },
          broken: { mediaType: 'image', mimeType: 'image/jpeg', localPath: 'broken' },
        },
        options,
      ),
    ).resolves.toBe('<svg />');

    expect(mediaFileService.readBytes).toHaveBeenCalledTimes(2);
    expect(renderLocationMapSvg).toHaveBeenCalledWith(content, {
      ...options,
      imageUris: { valid: 'data:image/png;base64,SGk=' },
    });
  });
});
