import {
  extensionForMimeType,
  MEDIA_PICKER_MIME_FILTERS,
  MediaType,
  isSupportedMediaMimeType,
  mediaTypeForMimeType,
} from '@keres/shared';
import * as DocumentPicker from 'expo-document-picker';
import { Directory, File, Paths } from 'expo-file-system';
import * as LegacyFileSystem from 'expo-file-system/legacy';
import * as VideoThumbnails from 'expo-video-thumbnails';
import { Platform } from 'react-native';
import * as webMediaStore from './webMediaStore';

const isWeb = Platform.OS === 'web';

/** Path em disco (sem o prefixo `desktop-media:`) onde esta mídia mora, na convenção do webMediaStore. */
function webMediaRelativePath(storyId: string, hash: string, mimeType: string): string {
  return `media/${storyId}/${hash}.${extensionForMimeType(mimeType)}`;
}

function webThumbnailRelativePath(storyId: string, hash: string): string {
  return `media/${storyId}/${hash}_thumb.jpg`;
}

/**
 * Arquivos de mídia no aparelho.
 *
 * Os arquivos ficam em `<documentos>/media/<storyId>/<hash>.<ext>`. O nome vem do conteúdo
 * e não do nome original por dois motivos: dois arquivos idênticos ocupam um espaço só, e
 * o mesmo endereço vale aqui e no servidor, o que dispensa guardar qualquer mapeamento
 * entre caminho local e caminho remoto.
 *
 * `documents` e não `cache`: o sistema pode esvaziar o cache a qualquer momento, e mídia
 * ainda não sincronizada não teria como ser recuperada.
 */

/** Uma mídia escolhida pela pessoa, já copiada para o armazenamento do aplicativo. */
export interface ImportedMedia {
  mediaType: MediaType;
  mimeType: string;
  fileName: string;
  hash: string;
  sizeBytes: number;
  localPath: string;
  /** Só para vídeo; ver `mediaFileService.thumbnailPathFor`. */
  thumbnailPath?: string;
}

export class UnsupportedMediaError extends Error {
  constructor(
    public readonly mimeType: string | undefined,
    public readonly fileName: string,
  ) {
    super(`Unsupported media type "${mimeType ?? 'unknown'}" for file "${fileName}".`);
    this.name = 'UnsupportedMediaError';
  }
}

function storyMediaDirectory(storyId: string): Directory {
  return new Directory(Paths.document, 'media', storyId);
}

function ensureDirectory(directory: Directory): Directory {
  if (!directory.exists) {
    directory.create({ intermediates: true, idempotent: true });
  }
  return directory;
}

/**
 * Nem todo seletor devolve o mime type (alguns só dão o nome do arquivo), então a extensão
 * serve de segunda tentativa antes de desistir do arquivo.
 */
function resolveMimeType(asset: DocumentPicker.DocumentPickerAsset): string | undefined {
  if (asset.mimeType && isSupportedMediaMimeType(asset.mimeType)) {
    return asset.mimeType.toLowerCase();
  }

  const extension = asset.name?.split('.').pop()?.toLowerCase();
  if (!extension) {
    return undefined;
  }

  const byExtension: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    webp: 'image/webp',
    bmp: 'image/bmp',
    heic: 'image/heic',
    heif: 'image/heif',
    mp4: 'video/mp4',
    mov: 'video/quicktime',
    webm: 'video/webm',
    m4v: 'video/x-m4v',
    mp3: 'audio/mpeg',
    m4a: 'audio/mp4',
    aac: 'audio/aac',
    wav: 'audio/wav',
    ogg: 'audio/ogg',
    flac: 'audio/flac',
    '3gp': 'video/3gpp',
  };

  return byExtension[extension];
}

/**
 * Extrai um quadro do vídeo e o grava junto da mídia, com o mesmo endereço por hash.
 *
 * Gerado uma vez e persistido (em vez de recalculado a cada exibição) porque extrair um
 * quadro é caro o bastante para travar a rolagem se acontecesse por célula de grade a cada
 * render. Falha aqui não impede a mídia de existir - vídeo sem miniatura ainda toca, só
 * mostra o ícone genérico na lista.
 */
async function generateVideoThumbnail(
  storyId: string,
  hash: string,
  videoUri: string,
): Promise<string | undefined> {
  try {
    const { uri } = await VideoThumbnails.getThumbnailAsync(videoUri, { time: 1000, quality: 0.5 });
    const directory = ensureDirectory(storyMediaDirectory(storyId));
    const destination = new File(directory, `${hash}_thumb.jpg`);
    if (destination.exists) {
      destination.delete();
    }
    new File(uri).copy(destination);
    return destination.uri;
  } catch (error) {
    console.warn('Could not generate video thumbnail:', error);
    return undefined;
  }
}

export const mediaFileService = {
  /** Caminho onde o arquivo desta mídia mora (ou moraria) neste aparelho. */
  localPathFor(storyId: string, hash: string, mimeType: string): string {
    if (isWeb) {
      return webMediaStore.DESKTOP_MEDIA_URI_PREFIX + webMediaRelativePath(storyId, hash, mimeType);
    }
    return new File(storyMediaDirectory(storyId), `${hash}.${extensionForMimeType(mimeType)}`).uri;
  },

  /** Caminho onde a miniatura deste vídeo moraria neste aparelho. */
  thumbnailPathFor(storyId: string, hash: string): string {
    if (isWeb) {
      return webMediaStore.DESKTOP_MEDIA_URI_PREFIX + webThumbnailRelativePath(storyId, hash);
    }
    return new File(storyMediaDirectory(storyId), `${hash}_thumb.jpg`).uri;
  },

  /**
   * Gera (ou regenera) a miniatura de um vídeo já presente no aparelho.
   *
   * Usada tanto ao importar quanto depois de um download vindo do servidor - nos dois
   * casos o arquivo de vídeo já está local, só falta o quadro extraído.
   */
  async generateVideoThumbnail(
    storyId: string,
    hash: string,
    videoUri: string,
  ): Promise<string | undefined> {
    return generateVideoThumbnail(storyId, hash, videoUri);
  },

  exists(localPath: string | null | undefined): boolean {
    if (!localPath) {
      return false;
    }
    if (isWeb) {
      return (
        localPath.startsWith(webMediaStore.DESKTOP_MEDIA_URI_PREFIX) &&
        webMediaStore.existsSync(localPath.slice(webMediaStore.DESKTOP_MEDIA_URI_PREFIX.length))
      );
    }
    try {
      return new File(localPath).exists;
    } catch {
      // Um caminho gravado por uma instalação anterior pode nem ser válido hoje; tratar
      // como ausente faz o download acontecer, que é a recuperação correta.
      return false;
    }
  },

  /**
   * Abre o seletor do sistema restrito aos formatos suportados.
   *
   * Devolve `null` se a pessoa cancelar.
   */
  async pick(): Promise<DocumentPicker.DocumentPickerAsset[] | null> {
    const result = await DocumentPicker.getDocumentAsync({
      type: [...MEDIA_PICKER_MIME_FILTERS],
      copyToCacheDirectory: true,
      multiple: true,
    });

    if (result.canceled || !result.assets || result.assets.length === 0) {
      return null;
    }
    return result.assets;
  },

  /**
   * Copia o arquivo escolhido para o armazenamento do aplicativo e calcula o hash.
   *
   * O hash é o MD5 nativo do `expo-file-system` - é o único digest que ele calcula, e
   * fazer SHA-256 em JS sobre um vídeo travaria a interface. Serve como endereço e
   * detecção de mudança; o servidor recalcula o hash dos bytes que recebe, então isto não
   * é uma garantia de segurança que dependa do cliente.
   */
  async importAsset(
    storyId: string,
    asset: DocumentPicker.DocumentPickerAsset,
  ): Promise<ImportedMedia> {
    const mimeType = resolveMimeType(asset);
    const mediaType = mediaTypeForMimeType(mimeType);

    if (!mimeType || !mediaType) {
      throw new UnsupportedMediaError(asset.mimeType, asset.name || 'unknown');
    }

    if (isWeb) {
      // O seletor web (expo-document-picker) entrega o próprio Blob escolhido em
      // `asset.file` - não há um caminho de sistema de arquivos nativo para copiar de.
      if (!asset.file) {
        throw new Error(`No file data available for "${asset.name}".`);
      }
      const bytes = new Uint8Array(await asset.file.arrayBuffer());
      const hash = webMediaStore.md5Hex(bytes);
      const relativePath = webMediaRelativePath(storyId, hash, mimeType);

      // Se já existe, os bytes são os mesmos por definição do endereçamento: regravar só
      // gastaria tempo e I/O.
      if (!webMediaStore.existsSync(relativePath)) {
        await webMediaStore.writeBytes(relativePath, bytes);
      }

      const localPath = webMediaStore.DESKTOP_MEDIA_URI_PREFIX + relativePath;
      const thumbnailPath =
        mediaType === 'video' ? await generateVideoThumbnail(storyId, hash, localPath) : undefined;

      return {
        mediaType,
        mimeType,
        fileName: asset.name || `${hash}.${extensionForMimeType(mimeType)}`,
        hash,
        sizeBytes: asset.size ?? bytes.byteLength,
        localPath,
        thumbnailPath,
      };
    }

    const source = new File(asset.uri);
    const hash = source.md5;
    if (!hash) {
      throw new Error(`Could not compute a content hash for "${asset.name}".`);
    }

    const directory = ensureDirectory(storyMediaDirectory(storyId));
    const destination = new File(directory, `${hash}.${extensionForMimeType(mimeType)}`);

    // Se já existe, os bytes são os mesmos por definição do endereçamento: recopiar só
    // gastaria tempo e I/O.
    if (!destination.exists) {
      source.copy(destination);
    }

    const thumbnailPath =
      mediaType === 'video'
        ? await generateVideoThumbnail(storyId, hash, destination.uri)
        : undefined;

    return {
      mediaType,
      mimeType,
      fileName: asset.name || destination.name,
      hash,
      sizeBytes: asset.size ?? destination.size ?? 0,
      localPath: destination.uri,
      thumbnailPath,
    };
  },

  /** Grava bytes vindos do servidor no endereço local correspondente ao hash. */
  async writeDownloaded(
    storyId: string,
    hash: string,
    mimeType: string,
    bytes: Uint8Array,
  ): Promise<string> {
    if (isWeb) {
      const relativePath = webMediaRelativePath(storyId, hash, mimeType);
      await webMediaStore.writeBytes(relativePath, bytes);
      return webMediaStore.DESKTOP_MEDIA_URI_PREFIX + relativePath;
    }

    const directory = ensureDirectory(storyMediaDirectory(storyId));
    const destination = new File(directory, `${hash}.${extensionForMimeType(mimeType)}`);

    if (destination.exists) {
      destination.delete();
    }
    destination.create();
    destination.write(bytes);

    return destination.uri;
  },

  /** Lê de volta os bytes de um arquivo já local (usado ao subir para o servidor). */
  async readBytes(localPath: string): Promise<Uint8Array> {
    if (isWeb) {
      if (!localPath.startsWith(webMediaStore.DESKTOP_MEDIA_URI_PREFIX)) {
        throw new Error(`Not a web media path: "${localPath}".`);
      }
      return webMediaStore.readBytes(
        localPath.slice(webMediaStore.DESKTOP_MEDIA_URI_PREFIX.length),
      );
    }
    return new File(localPath).bytes();
  },

  /** Destino a passar para um download direto (`File.downloadFileAsync`) - só nativo, ver MediaSyncService. */
  destinationFor(storyId: string, hash: string, mimeType: string): File {
    const directory = ensureDirectory(storyMediaDirectory(storyId));
    return new File(directory, `${hash}.${extensionForMimeType(mimeType)}`);
  },

  deleteLocal(localPath: string | null | undefined): void {
    if (!localPath) {
      return;
    }
    if (isWeb) {
      if (localPath.startsWith(webMediaStore.DESKTOP_MEDIA_URI_PREFIX)) {
        webMediaStore
          .deleteFile(localPath.slice(webMediaStore.DESKTOP_MEDIA_URI_PREFIX.length))
          .catch((error) => console.warn('Could not delete local media file:', localPath, error));
      }
      return;
    }
    try {
      const file = new File(localPath);
      if (file.exists) {
        file.delete();
      }
    } catch (error) {
      // Falhar em apagar um arquivo local não deve derrubar a exclusão da mídia em si: o
      // registro é a fonte da verdade, o arquivo órfão é desperdício de espaço, não um bug.
      console.warn('Could not delete local media file:', localPath, error);
    }
  },

  /** Remove todos os arquivos de mídia de uma história (usado ao excluir a história). */
  deleteStoryMedia(storyId: string): void {
    if (isWeb) {
      webMediaStore
        .deleteDirectory(`media/${storyId}`)
        .catch((error) =>
          console.warn('Could not delete media directory for story:', storyId, error),
        );
      return;
    }
    try {
      const directory = storyMediaDirectory(storyId);
      if (directory.exists) {
        directory.delete();
      }
    } catch (error) {
      console.warn('Could not delete media directory for story:', storyId, error);
    }
  },

  /** Removes the complete application-owned media tree during a full app reset. */
  async deleteAllMedia(): Promise<void> {
    try {
      if (isWeb) {
        // Plain browser builds do not have the Electron filesystem bridge and therefore
        // cannot have files in this store to remove.
        if (typeof window !== 'undefined' && window.keresMedia) {
          await webMediaStore.deleteDirectory('media');
        }
        return;
      }

      // Expo Go can reject Directory.delete() for a non-empty application directory.
      // The legacy implementation explicitly removes directory contents recursively and
      // is idempotent when the directory has never been created.
      const directory = new Directory(Paths.document, 'media');
      await LegacyFileSystem.deleteAsync(directory.uri, { idempotent: true });
    } catch (error) {
      // Orphaned media must not leave the reset half-complete. Its database references
      // are removed below, so a cleanup failure only means reclaiming disk space failed.
      console.warn('Could not remove every local media file during app reset:', error);
    }
  },
};
