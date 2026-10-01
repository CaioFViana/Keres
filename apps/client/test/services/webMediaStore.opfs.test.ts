/**
 * @jest-environment jsdom
 */
import {
  deleteDirectory,
  deleteFile,
  existsSync,
  hydrate,
  readBytes,
  writeBytes,
} from '../../src/services/webMediaStore';

type Entry =
  | { kind: 'file'; data: Uint8Array }
  | { kind: 'directory'; children: Map<string, Entry> };

function directoryEntry(): Entry {
  return { kind: 'directory', children: new Map() };
}

function fileEntry(data: Uint8Array): Entry {
  return { kind: 'file', data };
}

function installMemoryOpfs(root: Map<string, Entry>) {
  const asDirectory = (children: Map<string, Entry>): FileSystemDirectoryHandle =>
    ({
      kind: 'directory',
      async getDirectoryHandle(name: string, options?: { create?: boolean }) {
        let entry = children.get(name);
        if (!entry && options?.create) {
          entry = directoryEntry();
          children.set(name, entry);
        }
        if (!entry || entry.kind !== 'directory') {
          throw new Error(`missing directory ${name}`);
        }
        return asDirectory(entry.children);
      },
      async getFileHandle(name: string, options?: { create?: boolean }) {
        let entry = children.get(name);
        if (!entry && options?.create) {
          entry = fileEntry(new Uint8Array());
          children.set(name, entry);
        }
        if (!entry || entry.kind !== 'file') {
          throw new Error(`missing file ${name}`);
        }
        const file = entry;
        return {
          kind: 'file',
          async getFile() {
            return {
              arrayBuffer: async () =>
                file.data.buffer.slice(
                  file.data.byteOffset,
                  file.data.byteOffset + file.data.byteLength,
                ),
            };
          },
          async createWritable() {
            return {
              async write(bytes: BufferSource) {
                const view =
                  bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes as ArrayBuffer);
                file.data = view;
              },
              async close() {},
            };
          },
        } as FileSystemFileHandle;
      },
      async removeEntry(name: string) {
        children.delete(name);
      },
      async *entries() {
        for (const [name, entry] of children) {
          if (entry.kind === 'file') {
            yield [name, { kind: 'file' } as FileSystemHandle];
          } else {
            yield [name, asDirectory(entry.children) as unknown as FileSystemHandle];
          }
        }
      },
    }) as unknown as FileSystemDirectoryHandle;

  Object.defineProperty(navigator, 'storage', {
    configurable: true,
    value: {
      async getDirectory() {
        return asDirectory(root);
      },
    },
  });
}

beforeEach(() => {
  delete (window as { keresMedia?: unknown }).keresMedia;
});

it('stores media in OPFS when the Electron bridge is absent', async () => {
  const root = new Map<string, Entry>();
  installMemoryOpfs(root);

  await hydrate();
  expect(existsSync('media/story/a.png')).toBe(false);

  await writeBytes('media/story/a.png', new Uint8Array([9, 8, 7]));
  expect(existsSync('media/story/a.png')).toBe(true);
  await expect(readBytes('media/story/a.png')).resolves.toEqual(new Uint8Array([9, 8, 7]));

  await deleteFile('media/story/a.png');
  expect(existsSync('media/story/a.png')).toBe(false);

  await writeBytes('media/story/b.png', new Uint8Array([1]));
  await deleteDirectory('media/story');
  expect(existsSync('media/story/b.png')).toBe(false);
});

it('rejects an empty path and reports a browser without OPFS', async () => {
  const root = new Map<string, Entry>();
  installMemoryOpfs(root);

  await expect(writeBytes('', new Uint8Array([1]))).rejects.toThrow('Invalid media path');

  const storage = navigator.storage;
  Object.defineProperty(navigator, 'storage', { configurable: true, value: undefined });
  try {
    await expect(writeBytes('media/story/a.png', new Uint8Array([1]))).rejects.toThrow(
      'Origin Private File System is not available',
    );
  } finally {
    Object.defineProperty(navigator, 'storage', { configurable: true, value: storage });
  }
});

it('hydrates the whole nested tree and tolerates a failing listing', async () => {
  const root = new Map<string, Entry>();
  installMemoryOpfs(root);
  await writeBytes('media/story/a.png', new Uint8Array([1]));
  await writeBytes('media/story/nested/b.png', new Uint8Array([2]));

  // The earlier test already hydrated this backend; flip to Electron and back so the listing
  // actually runs again over the nested tree.
  (window as { keresMedia?: unknown }).keresMedia = {
    listAllFiles: async () => [],
  };
  await hydrate();
  delete (window as { keresMedia?: unknown }).keresMedia;
  await hydrate();

  expect(existsSync('media/story/a.png')).toBe(true);
  expect(existsSync('media/story/nested/b.png')).toBe(true);

  // A listing that throws hydrates nothing instead of breaking boot.
  (window as { keresMedia?: unknown }).keresMedia = {
    listAllFiles: async () => ['media/story/a.png'],
  };
  await hydrate();
  delete (window as { keresMedia?: unknown }).keresMedia;
  Object.defineProperty(navigator, 'storage', {
    configurable: true,
    value: {
      async getDirectory() {
        throw new Error('opfs gone');
      },
    },
  });
  try {
    await hydrate();
    expect(existsSync('media/story/a.png')).toBe(false);
  } finally {
    installMemoryOpfs(root);
  }
});

it('removes the whole media root when asked to delete the empty path', async () => {
  const root = new Map<string, Entry>();
  installMemoryOpfs(root);
  await writeBytes('media/story/a.png', new Uint8Array([1]));
  expect(root.has('keres-media')).toBe(true);

  await deleteDirectory('');

  expect(root.has('keres-media')).toBe(false);
});
