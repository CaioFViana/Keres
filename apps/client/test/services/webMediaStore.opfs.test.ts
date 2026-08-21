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

type Entry = { kind: 'file'; data: Uint8Array } | { kind: 'directory'; children: Map<string, Entry> };

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
              arrayBuffer: async () => file.data.buffer.slice(file.data.byteOffset, file.data.byteOffset + file.data.byteLength),
            };
          },
          async createWritable() {
            return {
              async write(bytes: BufferSource) {
                const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes as ArrayBuffer);
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
