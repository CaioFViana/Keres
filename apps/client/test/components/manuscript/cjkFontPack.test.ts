import { Directory, File } from 'expo-file-system';
import * as LegacyFileSystem from 'expo-file-system/legacy';
import { getClientFlavor } from '../../../src/utils/clientFlavor';
import {
  deleteFile as deleteStoredBytes,
  existsSync as storedBytesExist,
  readBytes as readStoredBytes,
  writeBytes as writeStoredBytes,
} from '../../../src/services/webMediaStore';
import {
  CJK_PACK,
  CJK_PACK_SIZE_LABEL,
  CjkPackError,
  cjkPackState,
  deleteCjkPack,
  downloadCjkPack,
  loadCjkMatrix,
} from '../../../src/components/features/manuscript/export/cjkFontPack';

jest.mock('../../../src/utils/clientFlavor', () => ({ getClientFlavor: jest.fn() }));
jest.mock('../../../src/services/webMediaStore', () => ({
  deleteFile: jest.fn(),
  existsSync: jest.fn(),
  readBytes: jest.fn(),
  writeBytes: jest.fn(),
}));
jest.mock('expo-file-system', () => ({
  Directory: jest.fn(),
  File: Object.assign(jest.fn(), { downloadFileAsync: jest.fn() }),
  Paths: { document: 'file:///document/' },
}));
jest.mock('expo-file-system/legacy', () => ({
  getInfoAsync: jest.fn(),
  downloadAsync: jest.fn(),
}));

const flavorMock = getClientFlavor as jest.Mock;
const directoryCtor = Directory as unknown as jest.Mock;
const fileCtor = File as unknown as jest.Mock;
const downloadFileAsync = File.downloadFileAsync as jest.Mock;
const getInfoAsync = LegacyFileSystem.getInfoAsync as jest.Mock;
const legacyDownload = LegacyFileSystem.downloadAsync as jest.Mock;
const writeStoredBytesMock = writeStoredBytes as jest.Mock;
const readStoredBytesMock = readStoredBytes as jest.Mock;
const storedBytesExistMock = storedBytesExist as jest.Mock;
const deleteStoredBytesMock = deleteStoredBytes as jest.Mock;
const fetchMock = jest.fn();
global.fetch = fetchMock;

const PACK_MAGIC = [0x00, 0x01, 0x00, 0x00];

/** A full-size pack body with valid magic. */
function fullPack(): Uint8Array {
  const bytes = new Uint8Array(CJK_PACK.bytes).fill(7);
  bytes.set(PACK_MAGIC);
  return bytes;
}

const STORED_PATH = `fonts/${CJK_PACK.id}-v${CJK_PACK.version}/${CJK_PACK.fileName}`;

function fileStub(overrides: Record<string, unknown> = {}) {
  return {
    uri: 'file:///document/fonts/serif-cjk-jp-v1/NotoSerifJP-Variable.ttf',
    exists: true,
    delete: jest.fn(),
    // No `slice` on purpose: the check must go through bytes().
    bytes: async () => fullPack(),
    ...overrides,
  };
}

function fetchOk(bytes: Uint8Array) {
  fetchMock.mockResolvedValueOnce({
    ok: true,
    status: 200,
    arrayBuffer: async () => bytes.buffer,
  });
}

describe('cjkFontPack', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    flavorMock.mockReturnValue('native');
    // Clear the in-memory fallback regardless of flavor.
    flavorMock.mockReturnValueOnce('web');
    await deleteCjkPack();
    flavorMock.mockReturnValue('native');
    directoryCtor.mockImplementation(() => ({ exists: true, create: jest.fn() }));
    fileCtor.mockImplementation(() => fileStub());
    getInfoAsync.mockResolvedValue({ exists: true, size: CJK_PACK.bytes });
    storedBytesExistMock.mockReturnValue(false);
  });

  it('derives the display size from the pinned bytes', () => {
    expect(CJK_PACK_SIZE_LABEL).toBe('13 MB');
  });

  it('reports ready when the cached size matches the manifest', async () => {
    await expect(cjkPackState()).resolves.toBe('ready');
  });

  it('reports missing when the cached file is absent or truncated', async () => {
    getInfoAsync.mockResolvedValueOnce({ exists: true, size: 12 });
    await expect(cjkPackState()).resolves.toBe('missing');
    getInfoAsync.mockRejectedValueOnce(new Error('gone'));
    await expect(cjkPackState()).resolves.toBe('missing');
  });

  it('downloads once, verifies size and magic, and loads the bytes', async () => {
    downloadFileAsync.mockResolvedValueOnce({});

    await expect(downloadCjkPack()).resolves.toBeUndefined();
    expect(downloadFileAsync).toHaveBeenCalledTimes(1);
    expect(downloadFileAsync.mock.calls[0][0]).toBe(CJK_PACK.url);
    const matrix = await loadCjkMatrix();
    expect(matrix?.length).toBe(CJK_PACK.bytes);
    expect(Array.from(matrix!.slice(0, 4))).toEqual(PACK_MAGIC);
  });

  it('deletes a bad download and reports the size failure', async () => {
    downloadFileAsync.mockResolvedValueOnce({});
    const deleted = jest.fn();
    fileCtor.mockImplementation(() =>
      fileStub({ bytes: async () => new Uint8Array(12), delete: deleted }),
    );

    const error: CjkPackError = await downloadCjkPack().catch((e) => e);
    expect(error).toBeInstanceOf(CjkPackError);
    expect(error.code).toBe('size');
    expect(deleted).toHaveBeenCalled();
    getInfoAsync.mockResolvedValue({ exists: false });
    await expect(cjkPackState()).resolves.toBe('missing');
  });

  it('reports a network failure without keeping state', async () => {
    downloadFileAsync.mockRejectedValueOnce(new Error('offline'));
    legacyDownload.mockRejectedValueOnce(new Error('offline'));

    const error: CjkPackError = await downloadCjkPack().catch((e) => e);
    expect(error).toBeInstanceOf(CjkPackError);
    expect(error.code).toBe('download');
  });

  it('deletes the pack file when asked', async () => {
    const deleted = jest.fn();
    fileCtor.mockImplementation(() => fileStub({ delete: deleted }));

    await deleteCjkPack();
    expect(deleted).toHaveBeenCalled();
  });

  it('loads nothing when the pack is missing', async () => {
    getInfoAsync.mockResolvedValue({ exists: false });
    fileCtor.mockImplementation(() =>
      fileStub({
        bytes: async () => {
          throw new Error('gone');
        },
      }),
    );

    await expect(loadCjkMatrix()).resolves.toBeNull();
  });

  describe.each(['web', 'desktop', 'serverless-web'])('on %s', (flavor) => {
    beforeEach(() => {
      flavorMock.mockReturnValue(flavor);
    });

    it('persists through webMediaStore and serves it afterwards', async () => {
      storedBytesExistMock.mockReturnValue(false);
      await expect(cjkPackState()).resolves.toBe('missing');
      fetchOk(fullPack());

      await expect(downloadCjkPack()).resolves.toBeUndefined();
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(fetchMock.mock.calls[0][0]).toBe(CJK_PACK.url);
      expect(writeStoredBytesMock).toHaveBeenCalledTimes(1);
      expect(writeStoredBytesMock.mock.calls[0][0]).toBe(STORED_PATH);
      expect(downloadFileAsync).not.toHaveBeenCalled();

      storedBytesExistMock.mockReturnValue(true);
      await expect(cjkPackState()).resolves.toBe('ready');
      readStoredBytesMock.mockResolvedValueOnce(fullPack());
      const matrix = await loadCjkMatrix();
      expect(matrix?.length).toBe(CJK_PACK.bytes);
    });

    it('rejects an HTTP error without storing anything', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 503,
        arrayBuffer: async () => new ArrayBuffer(0),
      });

      const error: CjkPackError = await downloadCjkPack().catch((e) => e);
      expect(error).toBeInstanceOf(CjkPackError);
      expect(error.code).toBe('download');
      expect(writeStoredBytesMock).not.toHaveBeenCalled();
      await expect(cjkPackState()).resolves.toBe('missing');
    });

    it('rejects a truncated body without storing anything', async () => {
      fetchOk(new Uint8Array(PACK_MAGIC));

      const error: CjkPackError = await downloadCjkPack().catch((e) => e);
      expect(error).toBeInstanceOf(CjkPackError);
      expect(error.code).toBe('size');
      expect(writeStoredBytesMock).not.toHaveBeenCalled();
    });

    it('keeps a session copy when the store backend is unavailable', async () => {
      fetchOk(fullPack());
      writeStoredBytesMock.mockRejectedValueOnce(new Error('no OPFS'));

      await expect(downloadCjkPack()).resolves.toBeUndefined();
      await expect(cjkPackState()).resolves.toBe('ready');
      const matrix = await loadCjkMatrix();
      expect(matrix?.length).toBe(CJK_PACK.bytes);

      await deleteCjkPack();
      expect(deleteStoredBytesMock).toHaveBeenCalledWith(STORED_PATH);
      await expect(cjkPackState()).resolves.toBe('missing');
    });

    it('loads nothing when the stored pack is corrupt', async () => {
      storedBytesExistMock.mockReturnValue(true);
      readStoredBytesMock.mockResolvedValueOnce(new Uint8Array(12));

      await expect(loadCjkMatrix()).resolves.toBeNull();
    });
  });
});
