import { Directory, File, Paths } from 'expo-file-system';
import * as LegacyFileSystem from 'expo-file-system/legacy';
import {
  deleteFile as deleteStoredBytes,
  existsSync as storedBytesExist,
  readBytes as readStoredBytes,
  writeBytes as writeStoredBytes,
} from './webMediaStore';
import { getClientFlavor } from '../utils/clientFlavor';

/**
 * The downloadable CJK serif pack (Noto Serif JP, variable, all weights).
 * Client-known by design: the pin mirrors `pdfFonts.manifest.json`
 * (`googleFontsCommit` + file sha), so any server - or none - serves the
 * export; the bytes always come from the same immutable URL. Re-pin on
 * purpose (new commit + reader gate), never live.
 *
 * Integrity on the device is size + TrueType magic + a successful fontkit
 * parse at export time. No sha256 here: expo-file-system only digests MD5
 * natively, and a 13 MB JS hash on every export is not worth it - the URL is
 * commit-pinned over TLS, and corruption shows up as a size/magic mismatch.
 */
export const CJK_PACK = {
  id: 'serif-cjk-jp',
  version: 1,
  fileName: 'NotoSerifJP-Variable.ttf',
  bytes: 13574352,
  url: 'https://cdn.jsdelivr.net/gh/google/fonts@9710da1eacb3be272583c3224dcb70f9da6eadbb/ofl/notoserifjp/NotoSerifJP%5Bwght%5D.ttf',
} as const;

/** TrueType magic: 00 01 00 00. */
const TTF_MAGIC = [0x00, 0x01, 0x00, 0x00];

/** Display size for prompts and settings, derived from the pinned bytes. */
export const CJK_PACK_SIZE_LABEL = `${Math.round(CJK_PACK.bytes / 1048576)} MB`;

/**
 * Native keeps the pack in the app-private fonts dir; every other flavor
 * goes through webMediaStore - a real file behind the Electron bridge on
 * desktop, OPFS in a hosted browser - exactly like saved media. `Platform.OS`
 * would lump desktop in with the browser and throw that persistence away.
 */
function isNative(): boolean {
  return getClientFlavor() === 'native';
}

/** webMediaStore path: global like the pack (not per story, unlike media). */
function storedPackPath(): string {
  return `fonts/${CJK_PACK.id}-v${CJK_PACK.version}/${CJK_PACK.fileName}`;
}

/**
 * Last resort when webMediaStore itself is unavailable (a browser without
 * OPFS): the pack lives in memory for the session. Same pin, same checks -
 * it just downloads again after a reload.
 */
let memoryBytes: Uint8Array | null = null;

function packDir(): Directory {
  return new Directory(Paths.document, 'fonts', `${CJK_PACK.id}-v${CJK_PACK.version}`);
}

function packFile(): File {
  return new File(packDir(), CJK_PACK.fileName);
}

function ensurePackDir(): void {
  const dir = packDir();
  if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
}

async function packSize(): Promise<number | null> {
  try {
    const info = await LegacyFileSystem.getInfoAsync(packFile().uri);
    return info.exists && typeof info.size === 'number' ? info.size : null;
  } catch {
    return null;
  }
}

export type CjkPackState = 'missing' | 'ready';

export async function cjkPackState(): Promise<CjkPackState> {
  if (memoryBytes) return 'ready';
  if (isNative()) return (await packSize()) === CJK_PACK.bytes ? 'ready' : 'missing';
  return storedBytesExist(storedPackPath()) ? 'ready' : 'missing';
}

export async function loadCjkMatrix(): Promise<Uint8Array | null> {
  try {
    if (memoryBytes) return memoryBytes;
    const bytes = isNative()
      ? new Uint8Array(await packFile().bytes())
      : await readStoredBytes(storedPackPath());
    checkSizeAndMagic(bytes);
    return bytes;
  } catch {
    return null;
  }
}

export async function deleteCjkPack(): Promise<void> {
  memoryBytes = null;
  if (isNative()) {
    try {
      const file = packFile();
      if (file.exists) file.delete();
    } catch {
      // Already gone: the state reads `missing` either way.
    }
    return;
  }
  try {
    await deleteStoredBytes(storedPackPath());
  } catch {
    // Already gone: the state reads `missing` either way.
  }
}

/** Thrown by `downloadCjkPack`; the caller turns it into UI, never a crash. */
export class CjkPackError extends Error {
  constructor(
    public readonly code: 'download' | 'size' | 'invalid',
    message: string,
  ) {
    super(message);
    this.name = 'CjkPackError';
  }
}

async function downloadTo(file: File): Promise<void> {
  try {
    await File.downloadFileAsync(CJK_PACK.url, file);
    return;
  } catch {
    const { uri } = await LegacyFileSystem.downloadAsync(CJK_PACK.url, file.uri);
    if (!uri) throw new Error('Legacy download returned no URI.');
  }
}

/** Size + TrueType magic shared by every download path. */
function checkSizeAndMagic(bytes: Uint8Array): void {
  if (bytes.length !== CJK_PACK.bytes) {
    throw new CjkPackError('size', 'The CJK font pack arrived truncated.');
  }
  if (!TTF_MAGIC.every((byte, index) => bytes[index] === byte)) {
    throw new CjkPackError('invalid', 'The CJK font pack is not a TrueType file.');
  }
}

async function fetchPackBytes(): Promise<Uint8Array> {
  let response: Response;
  try {
    response = await fetch(CJK_PACK.url);
  } catch (error) {
    throw new CjkPackError(
      'download',
      `Could not download the CJK font pack: ${(error as Error)?.message}`,
    );
  }
  if (!response.ok) {
    throw new CjkPackError(
      'download',
      `Could not download the CJK font pack: HTTP ${response.status}.`,
    );
  }
  return new Uint8Array(await response.arrayBuffer());
}

async function downloadNative(): Promise<void> {
  try {
    ensurePackDir();
  } catch (error) {
    throw new CjkPackError(
      'download',
      `Could not prepare the CJK font folder: ${(error as Error)?.message}`,
    );
  }
  const file = packFile();
  try {
    await downloadTo(file);
  } catch (error) {
    throw new CjkPackError(
      'download',
      `Could not download the CJK font pack: ${(error as Error)?.message}`,
    );
  }
  // Read through the native file API: RN's Blob does not guarantee
  // arrayBuffer(), so slice-then-decode is not portable here.
  let bytes: Uint8Array;
  try {
    bytes = new Uint8Array(await file.bytes());
  } catch (error) {
    await deleteCjkPack();
    throw new CjkPackError(
      'invalid',
      `Could not read the CJK font pack: ${(error as Error)?.message}`,
    );
  }
  try {
    checkSizeAndMagic(bytes);
  } catch (error) {
    await deleteCjkPack();
    throw error;
  }
}

/**
 * Downloads the pack and verifies size + TrueType magic. A bad file is never
 * kept: the state stays `missing` and the export falls back to `?` with an
 * explanation instead of embedding garbage. Native persists in the
 * app-private fonts dir (no permissions, invisible to the user, survives
 * updates); other flavors persist through webMediaStore (real file on
 * desktop, OPFS in the browser), with in-memory session storage only when
 * that backend is unavailable.
 */
export async function downloadCjkPack(): Promise<void> {
  if (isNative()) {
    await downloadNative();
    return;
  }
  const bytes = await fetchPackBytes();
  checkSizeAndMagic(bytes);
  try {
    await writeStoredBytes(storedPackPath(), bytes);
  } catch {
    memoryBytes = bytes;
  }
}
