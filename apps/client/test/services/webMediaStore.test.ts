/**
 * @jest-environment jsdom
 */
import {
  deleteDirectory,
  deleteFile,
  existsSync,
  hydrate,
  md5Hex,
  openInOs,
  readBytes,
  resolveBlobUri,
  writeBytes,
} from '../../src/services/webMediaStore';

const bridge = {
  deleteDirectory: jest.fn(),
  deleteFile: jest.fn(),
  listAllFiles: jest.fn(),
  openInOs: jest.fn(),
  readBytes: jest.fn(),
  writeBytes: jest.fn(),
};

beforeAll(() => {
  window.keresMedia = bridge;
});

beforeEach(() => {
  jest.clearAllMocks();
});

it('hydrates desktop paths and keeps its synchronous cache in step with writes and deletions', async () => {
  bridge.listAllFiles.mockResolvedValue(['media/story/already.png']);
  bridge.readBytes.mockResolvedValue(new Uint8Array([1, 2]));

  await hydrate();
  expect(existsSync('media/story/already.png')).toBe(true);
  await writeBytes('media/story/new.png', new Uint8Array([3]));
  expect(existsSync('media/story/new.png')).toBe(true);
  await expect(readBytes('media/story/new.png')).resolves.toEqual(new Uint8Array([1, 2]));
  await deleteFile('media/story/new.png');
  expect(existsSync('media/story/new.png')).toBe(false);
  await deleteDirectory('media/story');
  expect(existsSync('media/story/already.png')).toBe(false);
  expect(bridge.deleteDirectory).toHaveBeenCalledWith('media/story');
  expect(md5Hex(new Uint8Array([97]))).toBe('0cc175b9c0f1b6a831c399e269772661');
});

it('asks Electron to open a stored file with the OS', async () => {
  bridge.openInOs.mockResolvedValue(undefined);
  await expect(openInOs('media/story/notes.pdf')).resolves.toBe(true);
  expect(bridge.openInOs).toHaveBeenCalledWith('media/story/notes.pdf');
});

it('resolves blob URLs once and releases them when the file goes away', async () => {
  bridge.readBytes.mockResolvedValue(new Uint8Array([7]));
  const createObjectURL = jest.fn(() => 'blob:cached');
  const revokeObjectURL = jest.fn();
  Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: createObjectURL });
  Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: revokeObjectURL });

  // A blob URL lives for the session only, so it is cached per path - never persisted.
  await expect(resolveBlobUri('desktop-media:media/story/pic.png')).resolves.toBe('blob:cached');
  await expect(resolveBlobUri('desktop-media:media/story/pic.png')).resolves.toBe('blob:cached');
  expect(createObjectURL).toHaveBeenCalledTimes(1);

  await deleteFile('media/story/pic.png');
  expect(revokeObjectURL).toHaveBeenCalledWith('blob:cached');

  await writeBytes('media/story/other.png', new Uint8Array([8]));
  await expect(resolveBlobUri('desktop-media:media/story/other.png')).resolves.toBe('blob:cached');
  await deleteDirectory('media/story');
  expect(revokeObjectURL).toHaveBeenCalledTimes(2);
});

it('reports that the OS cannot open files without the Electron bridge', async () => {
  delete (window as { keresMedia?: unknown }).keresMedia;
  try {
    await expect(openInOs('media/story/notes.pdf')).resolves.toBe(false);
  } finally {
    window.keresMedia = bridge;
  }
});

it('hydrates once per backend and warns instead of throwing when the listing fails', async () => {
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  try {
    // A second hydrate on the same backend is free: the cache is already warm.
    await hydrate();
    expect(bridge.listAllFiles).not.toHaveBeenCalled();

    // Switching backends re-runs the listing; without OPFS here it finds nothing.
    delete (window as { keresMedia?: unknown }).keresMedia;
    await hydrate();
    expect(existsSync('media/anything.png')).toBe(false);

    // ...and a failing Electron listing warns instead of breaking boot.
    window.keresMedia = bridge;
    bridge.listAllFiles.mockRejectedValue(new Error('ipc gone'));
    await hydrate();
    expect(console.warn).toHaveBeenCalledWith(
      'webMediaStore: failed to hydrate existing paths.',
      expect.any(Error),
    );
  } finally {
    window.keresMedia = bridge;
    jest.restoreAllMocks();
  }
});
