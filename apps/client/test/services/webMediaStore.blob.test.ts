/**
 * @jest-environment node
 */

type Store = typeof import('@/src/services/webMediaStore');
/** The store keeps its URL cache in module state: each test gets a fresh copy of it. */
let store: Store;

/** The Electron bridge: the store reaches it through `window.keresMedia`, and it speaks bytes only. */
function installBridge(files: Map<string, Uint8Array>) {
  const keresMedia = {
    writeBytes: jest.fn(async (path: string, bytes: Uint8Array) => {
      files.set(path, bytes);
    }),
    readBytes: jest.fn(async (path: string) => {
      const found = files.get(path);
      if (!found) throw new Error(`missing ${path}`);
      return found;
    }),
    deleteFile: jest.fn(async (path: string) => {
      files.delete(path);
    }),
    deleteDirectory: jest.fn(),
    listAllFiles: jest.fn(async () => [...files.keys()]),
  };
  (globalThis as { window?: unknown }).window = { keresMedia };
  return keresMedia;
}

let urlCounter = 0;
/** The URL cache outlives a test (it is module state), so each test works on files of its own. */
let run = 0;
const createObjectURL = jest.fn(() => `blob:url-${(urlCounter += 1)}`);
const revokeObjectURL = jest.fn();

beforeEach(() => {
  jest.resetModules();
  store = require('@/src/services/webMediaStore');
  jest.useFakeTimers();
  urlCounter = 0;
  run += 1;
  createObjectURL.mockClear();
  revokeObjectURL.mockClear();
  (URL as unknown as { createObjectURL: unknown }).createObjectURL = createObjectURL;
  (URL as unknown as { revokeObjectURL: unknown }).revokeObjectURL = revokeObjectURL;
});

afterEach(() => {
  jest.useRealTimers();
  delete (globalThis as { window?: unknown }).window;
});

describe('md5OfBlob', () => {
  it('gives the same digest as hashing the bytes, for a file spanning several chunks', async () => {
    const bytes = new Uint8Array(9 * 1024 * 1024 + 123);
    for (let index = 0; index < bytes.length; index += 997) bytes[index] = index % 251;

    expect(await store.md5OfBlob(new Blob([bytes as BlobPart]))).toBe(store.md5Hex(bytes));
  });

  it('hashes an empty file', async () => {
    expect(await store.md5OfBlob(new Blob([]))).toBe(store.md5Hex(new Uint8Array()));
  });
});

describe('readBlob and writeBlob over a bridge that speaks bytes', () => {
  it('wraps the bytes it reads, and stores a Blob as bytes', async () => {
    const files = new Map<string, Uint8Array>();
    const bridge = installBridge(files);

    await store.writeBlob('media/story/a.png', new Blob([new Uint8Array([1, 2, 3]) as BlobPart]));

    expect(bridge.writeBytes).toHaveBeenCalledWith('media/story/a.png', new Uint8Array([1, 2, 3]));
    expect(store.existsSync('media/story/a.png')).toBe(true);
    const blob = await store.readBlob('media/story/a.png');
    expect(new Uint8Array(await blob.arrayBuffer())).toEqual(new Uint8Array([1, 2, 3]));
  });
});

describe('resolveBlobUri', () => {
  const seed = (files: Map<string, Uint8Array>, count: number) => {
    for (let index = 0; index < count; index += 1) {
      files.set(`media/run${run}/${index}.png`, new Uint8Array([index % 256]));
    }
  };
  const uri = (index: number) => `desktop-media:media/run${run}/${index}.png`;

  it('gives the same URL for the same file, and makes it once', async () => {
    const files = new Map<string, Uint8Array>();
    seed(files, 1);
    installBridge(files);

    const first = await store.resolveBlobUri(uri(0));
    const second = await store.resolveBlobUri(uri(0));

    expect(second).toBe(first);
    expect(createObjectURL).toHaveBeenCalledTimes(1);
  });

  it('shares one URL between screens that ask for the same file together', async () => {
    const files = new Map<string, Uint8Array>();
    seed(files, 1);
    installBridge(files);

    const [a, b] = await Promise.all([store.resolveBlobUri(uri(0)), store.resolveBlobUri(uri(0))]);

    expect(a).toBe(b);
    expect(createObjectURL).toHaveBeenCalledTimes(1);
  });

  it('keeps no more URLs than the limit: the least recently used are released, a little later', async () => {
    const files = new Map<string, Uint8Array>();
    seed(files, store.BLOB_URL_CACHE_LIMIT + 2);
    installBridge(files);

    const urls: string[] = [];
    for (let index = 0; index < store.BLOB_URL_CACHE_LIMIT + 2; index += 1) {
      urls.push(await store.resolveBlobUri(uri(index)));
    }

    // Two were pushed out, the oldest first - but not revoked yet: an element may be about to load them.
    expect(revokeObjectURL).not.toHaveBeenCalled();
    jest.advanceTimersByTime(30_001);
    expect(revokeObjectURL.mock.calls.map(([url]) => url)).toEqual([urls[0], urls[1]]);

    // The file that was pushed out is made again when it is asked for.
    const again = await store.resolveBlobUri(uri(0));
    expect(again).not.toBe(urls[0]);
  });

  it('counts a use as recent: a file asked for again outlives older ones', async () => {
    const files = new Map<string, Uint8Array>();
    seed(files, store.BLOB_URL_CACHE_LIMIT + 1);
    installBridge(files);

    const first = await store.resolveBlobUri(uri(0));
    for (let index = 1; index < store.BLOB_URL_CACHE_LIMIT; index += 1) {
      await store.resolveBlobUri(uri(index));
    }
    // Touch the oldest, then add one more: the second oldest goes instead.
    await store.resolveBlobUri(uri(0));
    await store.resolveBlobUri(uri(store.BLOB_URL_CACHE_LIMIT));
    jest.advanceTimersByTime(30_001);

    expect(revokeObjectURL).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).not.toHaveBeenCalledWith(first);
  });

  it('forgets the URL of a file that is deleted, and revokes it at once', async () => {
    const files = new Map<string, Uint8Array>();
    seed(files, 1);
    installBridge(files);
    const url = await store.resolveBlobUri(uri(0));

    await store.deleteFile(`media/run${run}/0.png`);

    expect(revokeObjectURL).toHaveBeenCalledWith(url);
  });
});
