import SparkMD5 from 'spark-md5';

/**
 * Media storage on the web platform.
 *
 * Two backs, one interface:
 *   - Electron (`window.keresMedia`): real files through IPC, visible in Explorer.
 *   - Hosted browser: the Origin Private File System, the same sandbox the web SQLite already lives in.
 *     No IPC bridge. It needs no SharedArrayBuffer (the OPFS API is async).
 *
 * Path convention: always relative to the root (e.g. `media/<storyId>/<hash>.<ext>`).
 * `mediaFileService` prefixes it with `desktop-media:` in the value stored in the database.
 */

export const DESKTOP_MEDIA_URI_PREFIX = 'desktop-media:';

interface KeresMediaBridge {
  writeBytes(relativePath: string, bytes: Uint8Array): Promise<void>;
  readBytes(relativePath: string): Promise<Uint8Array>;
  deleteFile(relativePath: string): Promise<void>;
  deleteDirectory(relativePath: string): Promise<void>;
  listAllFiles(): Promise<string[]>;
  /** Electron only: open this stored file with the OS handler. */
  openInOs?(relativePath: string): Promise<void>;
}

declare global {
  interface Window {
    /** Exposed by apps/desktop/src/preload.ts via contextBridge - only present under Electron. */
    keresMedia?: KeresMediaBridge;
  }
}

function electronBridge(): KeresMediaBridge | undefined {
  return typeof window === 'undefined' ? undefined : window.keresMedia;
}

function splitRelativePath(relativePath: string): { dirParts: string[]; fileName: string } {
  const parts = relativePath.split('/').filter(Boolean);
  const fileName = parts.pop();
  if (!fileName) {
    throw new Error(`Invalid media path: "${relativePath}"`);
  }
  return { dirParts: parts, fileName };
}

async function opfsRoot(): Promise<FileSystemDirectoryHandle> {
  if (typeof navigator === 'undefined' || !navigator.storage?.getDirectory) {
    throw new Error('Origin Private File System is not available in this browser.');
  }
  const root = await navigator.storage.getDirectory();
  return root.getDirectoryHandle('keres-media', { create: true });
}

async function opfsDirectory(
  root: FileSystemDirectoryHandle,
  dirParts: string[],
  create: boolean,
): Promise<FileSystemDirectoryHandle> {
  let directory = root;
  for (const part of dirParts) {
    directory = await directory.getDirectoryHandle(part, { create });
  }
  return directory;
}

async function opfsList(directory: FileSystemDirectoryHandle, prefix: string): Promise<string[]> {
  const paths: string[] = [];
  const entries = (
    directory as FileSystemDirectoryHandle & {
      entries: () => AsyncIterableIterator<[string, FileSystemHandle]>;
    }
  ).entries();
  for await (const [name, handle] of entries) {
    const next = prefix ? `${prefix}/${name}` : name;
    if (handle.kind === 'file') {
      paths.push(next);
    } else if (handle.kind === 'directory') {
      paths.push(...(await opfsList(handle as FileSystemDirectoryHandle, next)));
    }
  }
  return paths;
}

const opfsBackend: KeresMediaBridge = {
  async writeBytes(relativePath, bytes) {
    const { dirParts, fileName } = splitRelativePath(relativePath);
    const directory = await opfsDirectory(await opfsRoot(), dirParts, true);
    const file = await directory.getFileHandle(fileName, { create: true });
    const writable = await file.createWritable();
    await writable.write(bytes as BufferSource);
    await writable.close();
  },
  async readBytes(relativePath) {
    const { dirParts, fileName } = splitRelativePath(relativePath);
    const directory = await opfsDirectory(await opfsRoot(), dirParts, false);
    const file = await directory.getFileHandle(fileName);
    const blob = await file.getFile();
    return new Uint8Array(await blob.arrayBuffer());
  },
  async deleteFile(relativePath) {
    const { dirParts, fileName } = splitRelativePath(relativePath);
    const directory = await opfsDirectory(await opfsRoot(), dirParts, false);
    await directory.removeEntry(fileName);
  },
  async deleteDirectory(relativeDirPath) {
    const parts = relativeDirPath.split('/').filter(Boolean);
    const name = parts.pop();
    if (!name) {
      const storageRoot = await navigator.storage.getDirectory();
      await storageRoot.removeEntry('keres-media', { recursive: true });
      return;
    }
    const parent =
      parts.length === 0 ? await opfsRoot() : await opfsDirectory(await opfsRoot(), parts, false);
    await parent.removeEntry(name, { recursive: true });
  },
  async listAllFiles() {
    try {
      return await opfsList(await opfsRoot(), '');
    } catch {
      return [];
    }
  },
};

function backend(): KeresMediaBridge {
  return electronBridge() ?? opfsBackend;
}

function backendKind(): 'electron' | 'opfs' {
  return electronBridge() ? 'electron' : 'opfs';
}

/**
 * Every path known to exist, kept in memory because `mediaFileService` exposes `exists()`
 * synchronously (a contract shared with the native check, `File.exists`, which is synchronous too).
 */
const knownPaths = new Set<string>();
let hydrated = false;
let hydratedBackend: 'electron' | 'opfs' | null = null;

/** It populates `knownPaths` by listing what is already written. Call it once at boot. */
export async function hydrate(): Promise<void> {
  const kind = backendKind();
  if (hydrated && hydratedBackend === kind) {
    return;
  }
  knownPaths.clear();
  hydrated = true;
  hydratedBackend = kind;
  try {
    const paths = await backend().listAllFiles();
    for (const path of paths) {
      knownPaths.add(path);
    }
  } catch (error) {
    console.warn('webMediaStore: failed to hydrate existing paths.', error);
  }
}

export function existsSync(relativePath: string): boolean {
  return knownPaths.has(relativePath);
}

export async function writeBytes(relativePath: string, bytes: Uint8Array): Promise<void> {
  await backend().writeBytes(relativePath, bytes);
  knownPaths.add(relativePath);
}

export async function readBytes(relativePath: string): Promise<Uint8Array> {
  return backend().readBytes(relativePath);
}

export async function deleteFile(relativePath: string): Promise<void> {
  knownPaths.delete(relativePath);
  const blobUrl = blobUrlCache.get(relativePath);
  if (blobUrl) {
    URL.revokeObjectURL(blobUrl);
    blobUrlCache.delete(relativePath);
  }
  await backend().deleteFile(relativePath);
}

/**
 * Opens a stored media file with the operating system (PDF reader, Word, …).
 *
 * Only the Electron bridge can do this: OPFS has no path the OS can see. Returns `false` when
 * that bridge is absent so the caller can fall back (a new browser tab, a share sheet).
 */
export async function openInOs(relativePath: string): Promise<boolean> {
  const electron = electronBridge();
  if (!electron?.openInOs) {
    return false;
  }
  await electron.openInOs(relativePath);
  return true;
}

export async function deleteDirectory(relativeDirPath: string): Promise<void> {
  const prefix = `${relativeDirPath}/`;
  for (const path of [...knownPaths]) {
    if (path.startsWith(prefix)) {
      knownPaths.delete(path);
      const blobUrl = blobUrlCache.get(path);
      if (blobUrl) {
        URL.revokeObjectURL(blobUrl);
        blobUrlCache.delete(path);
      }
    }
  }
  await backend().deleteDirectory(relativeDirPath);
}

/** MD5 hex - precisa ser exatamente o mesmo algoritmo do servidor (ver MediaStorageService.ts). */
export function md5Hex(bytes: Uint8Array): string {
  return SparkMD5.ArrayBuffer.hash(bytes.buffer as ArrayBuffer);
}

const blobUrlCache = new Map<string, string>();

/**
 * Resolves a media path into a `blob:` URL renderable by `<Image>`/`<video>`/`<audio>`.
 *
 * Never persisted (a `blob:` URL is only valid for the session that created it) - which is why the
 * database stores the stable path (`desktop-media:media/...`), and each screen resolves the blob URL at
 * display time (see `useResolvedMediaUri`).
 */
export async function resolveBlobUri(mediaUri: string): Promise<string> {
  const relativePath = mediaUri.slice(DESKTOP_MEDIA_URI_PREFIX.length);
  const cached = blobUrlCache.get(relativePath);
  if (cached) {
    return cached;
  }
  const bytes = await readBytes(relativePath);
  const blob = new Blob([bytes as BlobPart]);
  const url = URL.createObjectURL(blob);
  blobUrlCache.set(relativePath, url);
  return url;
}
