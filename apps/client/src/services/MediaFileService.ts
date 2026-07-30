import {
  extensionForMimeType,
  MEDIA_PICKER_MIME_FILTERS,
  MediaType,
  isSupportedMediaMimeType,
  mediaTypeForMimeType,
} from '@keres/shared';
import * as DocumentPicker from 'expo-document-picker';
import { Directory, File, Paths } from 'expo-file-system';

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
}

export class UnsupportedMediaError extends Error {
  constructor(public readonly mimeType: string | undefined, public readonly fileName: string) {
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
    jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif',
    webp: 'image/webp', bmp: 'image/bmp', heic: 'image/heic', heif: 'image/heif',
    mp4: 'video/mp4', mov: 'video/quicktime', webm: 'video/webm', m4v: 'video/x-m4v',
    mp3: 'audio/mpeg', m4a: 'audio/mp4', aac: 'audio/aac', wav: 'audio/wav',
    ogg: 'audio/ogg', flac: 'audio/flac', '3gp': 'video/3gpp',
  };

  return byExtension[extension];
}

export const mediaFileService = {
  /** Caminho onde o arquivo desta mídia mora (ou moraria) neste aparelho. */
  localPathFor(storyId: string, hash: string, mimeType: string): string {
    return new File(storyMediaDirectory(storyId), `${hash}.${extensionForMimeType(mimeType)}`).uri;
  },

  exists(localPath: string | null | undefined): boolean {
    if (!localPath) {
      return false;
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
  async importAsset(storyId: string, asset: DocumentPicker.DocumentPickerAsset): Promise<ImportedMedia> {
    const mimeType = resolveMimeType(asset);
    const mediaType = mediaTypeForMimeType(mimeType);

    if (!mimeType || !mediaType) {
      throw new UnsupportedMediaError(asset.mimeType, asset.name || 'unknown');
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

    return {
      mediaType,
      mimeType,
      fileName: asset.name || destination.name,
      hash,
      sizeBytes: asset.size ?? destination.size ?? 0,
      localPath: destination.uri,
    };
  },

  /** Grava bytes vindos do servidor no endereço local correspondente ao hash. */
  async writeDownloaded(storyId: string, hash: string, mimeType: string, bytes: Uint8Array): Promise<string> {
    const directory = ensureDirectory(storyMediaDirectory(storyId));
    const destination = new File(directory, `${hash}.${extensionForMimeType(mimeType)}`);

    if (destination.exists) {
      destination.delete();
    }
    destination.create();
    destination.write(bytes);

    return destination.uri;
  },

  /** Destino a passar para um download direto (`File.downloadFileAsync`). */
  destinationFor(storyId: string, hash: string, mimeType: string): File {
    const directory = ensureDirectory(storyMediaDirectory(storyId));
    return new File(directory, `${hash}.${extensionForMimeType(mimeType)}`);
  },

  deleteLocal(localPath: string | null | undefined): void {
    if (!localPath) {
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
    try {
      const directory = storyMediaDirectory(storyId);
      if (directory.exists) {
        directory.delete();
      }
    } catch (error) {
      console.warn('Could not delete media directory for story:', storyId, error);
    }
  },
};
