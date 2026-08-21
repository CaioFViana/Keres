/**
 * @jest-environment jsdom
 */
import {
  deleteDirectory,
  deleteFile,
  existsSync,
  hydrate,
  md5Hex,
  readBytes,
  writeBytes,
} from '../../src/services/webMediaStore';

const bridge = {
  deleteDirectory: jest.fn(),
  deleteFile: jest.fn(),
  listAllFiles: jest.fn(),
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
