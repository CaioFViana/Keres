import SparkMD5 from 'spark-md5';

/**
 * Armazenamento de mídia para a plataforma web (Electron): arquivos reais em disco, através
 * da ponte IPC exposta por `apps/desktop/src/preload.ts` (a renderer não tem acesso a
 * sistema de arquivos por conta própria - `contextIsolation: true`). SQLite continua no OPFS
 * via `expo-sqlite`, cuja implementação web já funciona; mídia (fotos/vídeos) não tem motivo
 * para morar dentro do sistema de arquivos sandboxed do Chromium quando o processo principal
 * do Electron pode gravar arquivos de verdade - visíveis no Explorer/Finder, fáceis de fazer
 * backup, exatamente o tipo de capacidade nativa que só um app desktop de verdade oferece.
 *
 * Convenção de path: sempre relativo à raiz do armazenamento (ex: `media/<storyId>/<hash>.<ext>`),
 * espelhando a mesma estrutura usada nativamente sob `Paths.document`. `mediaFileService`
 * prefixa isso com `desktop-media:` ao devolver como `localPath`/`thumbnailPath` (ver
 * MediaFileService.ts), para as duas plataformas serem distinguíveis por quem consome o
 * valor guardado no banco (`useResolvedMediaUri`).
 */

export const DESKTOP_MEDIA_URI_PREFIX = 'desktop-media:';

interface KeresMediaBridge {
  writeBytes(relativePath: string, bytes: Uint8Array): Promise<void>;
  readBytes(relativePath: string): Promise<Uint8Array>;
  deleteFile(relativePath: string): Promise<void>;
  deleteDirectory(relativePath: string): Promise<void>;
  listAllFiles(): Promise<string[]>;
}

declare global {
  interface Window {
    /** Exposed by apps/desktop/src/preload.ts via contextBridge - only present under Electron. */
    keresMedia?: KeresMediaBridge;
  }
}

function bridge(): KeresMediaBridge {
  if (!window.keresMedia) {
    throw new Error(
      'window.keresMedia is not available - media storage on web requires running inside the Electron shell (apps/desktop), not a plain browser tab.',
    );
  }
  return window.keresMedia;
}

/**
 * Todos os paths conhecidos como existentes, mantido em memória porque `mediaFileService`
 * expõe `exists()` de forma síncrona (contrato compartilhado com a checagem nativa,
 * `File.exists`, que também é síncrona) - a ponte IPC em si só responde de forma assíncrona.
 * Somos o único escritor deste armazenamento, então o cache não corre o risco de divergir
 * por causa de mudança externa; só precisa ser semeado uma vez no boot (`hydrate`).
 */
const knownPaths = new Set<string>();
let hydrated = false;

/** Popula `knownPaths` listando o que já está em disco de sessões anteriores. Chamar uma vez no boot. */
export async function hydrate(): Promise<void> {
  if (hydrated) {
    return;
  }
  hydrated = true;
  try {
    const paths = await bridge().listAllFiles();
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
  await bridge().writeBytes(relativePath, bytes);
  knownPaths.add(relativePath);
}

export async function readBytes(relativePath: string): Promise<Uint8Array> {
  return bridge().readBytes(relativePath);
}

export async function deleteFile(relativePath: string): Promise<void> {
  knownPaths.delete(relativePath);
  await bridge().deleteFile(relativePath);
}

export async function deleteDirectory(relativeDirPath: string): Promise<void> {
  const prefix = `${relativeDirPath}/`;
  for (const path of knownPaths) {
    if (path.startsWith(prefix)) {
      knownPaths.delete(path);
    }
  }
  await bridge().deleteDirectory(relativeDirPath);
}

/** MD5 hex - precisa ser exatamente o mesmo algoritmo do servidor (ver MediaStorageService.ts). */
export function md5Hex(bytes: Uint8Array): string {
  return SparkMD5.ArrayBuffer.hash(bytes.buffer as ArrayBuffer);
}

const blobUrlCache = new Map<string, string>();

/**
 * Resolve um path de mídia para um `blob:` URL renderizável por `<Image>`/`<video>`/`<audio>`.
 *
 * Nunca persistido (um `blob:` URL só vale para a sessão que o criou) - por isso o banco
 * guarda o path estável (`desktop-media:media/...`), e cada tela resolve o blob URL na hora
 * de exibir (ver `useResolvedMediaUri`). Cacheado pelo resto da sessão em vez de revogado a
 * cada unmount: mais simples, e a galeria de uma história não é grande o bastante para isso
 * acumular memória de forma relevante.
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
