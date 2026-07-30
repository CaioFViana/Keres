import { MediaBlobStatusResponseType } from '@keres/shared';
import { File } from 'expo-file-system';
import { AppDrizzleClient } from '../db';
import { GallerySelect, ServerSelect } from '../db/schema';
import { getServerAccessToken, isOfflineError, KeresAxiosInstance } from './apiClient';
import { mediaFileService } from './MediaFileService';
import { createGalleryService, GalleryService } from './storymanagement/GalleryService';

/**
 * O canal binário da galeria.
 *
 * Os metadados de uma mídia viajam pelo log de operações como qualquer outra entidade;
 * mandar os bytes de um vídeo pelo mesmo caminho não é viável, então eles sobem e descem
 * por rotas próprias, endereçados pelo hash do conteúdo.
 *
 * O hash é o que torna isso barato: antes de subir qualquer coisa perguntamos ao servidor
 * quais hashes ele já tem, e o que ele já tem não sobe de novo - inclusive quando outra
 * pessoa já subiu exatamente o mesmo arquivo. É também o que responde "mudou?": conteúdo
 * diferente é hash diferente, e hash diferente é registro diferente.
 */

/** Quantos blobs transferir por ciclo, para um ciclo de sync não virar um upload longo. */
const MAX_TRANSFERS_PER_CYCLE = 5;

export interface MediaSyncSummary {
  uploaded: number;
  downloaded: number;
  failed: number;
  /** Verdadeiro quando o servidor não respondeu; o ciclo deve tratar como offline. */
  offline: boolean;
}

export class MediaSyncService {
  private galleryService: GalleryService;

  constructor(private db: AppDrizzleClient) {
    this.galleryService = createGalleryService(db);
  }

  /**
   * Reconcilia os arquivos de uma história com o servidor.
   *
   * Nunca lança por falha de transferência: mídia que não subiu continua marcada como
   * pendente e é tentada no ciclo seguinte. Um vídeo grande falhando não pode derrubar a
   * sincronização de texto da história inteira.
   */
  async syncStoryMedia(client: KeresAxiosInstance, server: ServerSelect, storyId: string): Promise<MediaSyncSummary> {
    const summary: MediaSyncSummary = { uploaded: 0, downloaded: 0, failed: 0, offline: false };

    try {
      await this.uploadPending(client, storyId, summary);
      await this.downloadMissing(client, server, storyId, summary);
    } catch (error) {
      if (isOfflineError(error)) {
        summary.offline = true;
        return summary;
      }
      console.log(`MediaSyncService: media sync for story ${storyId} did not complete.`, error);
    }

    return summary;
  }

  private async uploadPending(client: KeresAxiosInstance, storyId: string, summary: MediaSyncSummary): Promise<void> {
    const pending = await this.galleryService.getPendingUploads(storyId);
    if (pending.length === 0) {
      return;
    }

    // Um blob que o servidor já tem não precisa subir - seja porque um envio anterior
    // chegou e a resposta se perdeu, seja porque outra pessoa subiu o mesmo arquivo.
    const status = await this.fetchBlobStatus(client, storyId, pending.map((media) => media.hash));
    const alreadyPresent = new Set(status.present);

    const toUpload: GallerySelect[] = [];
    for (const media of pending) {
      if (alreadyPresent.has(media.hash)) {
        await this.galleryService.setLocalFileState(media.id, { uploadState: 'uploaded' });
        continue;
      }
      toUpload.push(media);
    }

    for (const media of toUpload.slice(0, MAX_TRANSFERS_PER_CYCLE)) {
      if (!mediaFileService.exists(media.localPath)) {
        // O registro existe mas o arquivo sumiu deste aparelho (limpeza do sistema,
        // reinstalação). Não há o que subir; vira um caso de download.
        console.warn(`MediaSyncService: local file missing for gallery ${media.id}; will try to download instead.`);
        await this.galleryService.setLocalFileState(media.id, {
          localPath: null,
          uploadState: 'uploaded',
          downloadState: 'pending',
        });
        continue;
      }

      try {
        const form = new FormData();
        // O React Native aceita este formato de "arquivo" em FormData; é como ele expõe
        // um arquivo local para multipart sem carregar tudo em memória.
        form.append('file', {
          uri: media.localPath as string,
          name: media.fileName,
          type: media.mimeType,
        } as unknown as Blob);
        form.append('mimeType', media.mimeType);

        await client.post(`/media/${storyId}/blobs/${media.hash}`, form, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });

        await this.galleryService.setLocalFileState(media.id, { uploadState: 'uploaded' });
        summary.uploaded += 1;
      } catch (error) {
        if (isOfflineError(error)) {
          throw error;
        }
        console.log(`MediaSyncService: failed to upload media ${media.id} (${media.hash}).`, error);
        await this.galleryService.setLocalFileState(media.id, { uploadState: 'failed' });
        summary.failed += 1;
      }
    }
  }

  private async downloadMissing(client: KeresAxiosInstance, server: ServerSelect, storyId: string, summary: MediaSyncSummary): Promise<void> {
    const pending = await this.galleryService.getPendingDownloads(storyId);
    if (pending.length === 0) {
      return;
    }

    for (const media of pending.slice(0, MAX_TRANSFERS_PER_CYCLE)) {
      // Pode já estar aqui de uma outra mídia com o mesmo conteúdo, ou de um download que
      // terminou e não chegou a ser marcado.
      const existingPath = mediaFileService.localPathFor(storyId, media.hash, media.mimeType);
      if (mediaFileService.exists(existingPath)) {
        await this.galleryService.setLocalFileState(media.id, {
          localPath: existingPath,
          downloadState: 'downloaded',
          thumbnailPath: await this.ensureThumbnail(storyId, media, existingPath),
        });
        summary.downloaded += 1;
        continue;
      }

      try {
        const baseUrl = client.defaults.baseURL?.replace(/\/+$/, '');
        if (!baseUrl) {
          return;
        }

        // Download direto para disco em vez de passar pelo axios: trazer um vídeo para a
        // memória do JS como base64 estoura o heap em aparelhos modestos.
        const destination = mediaFileService.destinationFor(storyId, media.hash, media.mimeType);
        const downloaded = await File.downloadFileAsync(
          `${baseUrl}/media/${storyId}/blobs/${media.hash}`,
          destination,
          { headers: this.authHeaders(server), idempotent: true }
        );

        await this.galleryService.setLocalFileState(media.id, {
          localPath: downloaded.uri,
          downloadState: 'downloaded',
          thumbnailPath: await this.ensureThumbnail(storyId, media, downloaded.uri),
        });
        summary.downloaded += 1;
      } catch (error) {
        console.log(`MediaSyncService: failed to download media ${media.id} (${media.hash}).`, error);
        await this.galleryService.setLocalFileState(media.id, { downloadState: 'failed' });
        summary.failed += 1;
      }
    }
  }

  /**
   * Gera a miniatura de um vídeo que acabou de chegar por sincronização.
   *
   * Só se aplica a `mediaType: 'video'`, e só quando ainda não existe uma - o mesmo
   * conteúdo baixado de novo (outra entidade vinculada, um retry) reaproveita o arquivo já
   * extraído em vez de gerar de novo.
   */
  private async ensureThumbnail(storyId: string, media: GallerySelect, videoUri: string): Promise<string | null | undefined> {
    if (media.mediaType !== 'video') {
      return undefined;
    }
    const expectedPath = mediaFileService.thumbnailPathFor(storyId, media.hash);
    if (mediaFileService.exists(media.thumbnailPath) || mediaFileService.exists(expectedPath)) {
      return media.thumbnailPath ?? expectedPath;
    }
    return (await mediaFileService.generateVideoThumbnail(storyId, media.hash, videoUri)) ?? null;
  }

  private async fetchBlobStatus(client: KeresAxiosInstance, storyId: string, hashes: string[]): Promise<MediaBlobStatusResponseType> {
    if (hashes.length === 0) {
      return { present: [], missing: [] };
    }
    // A rota aceita no máximo 500 hashes por chamada.
    const unique = Array.from(new Set(hashes)).slice(0, 500);
    const response = await client.post<MediaBlobStatusResponseType>(`/media/${storyId}/blobs/status`, { hashes: unique });
    return response.data;
  }

  /**
   * O download não passa pelo Axios, então o `Authorization` que o interceptor colocaria
   * precisa ser montado à mão - a partir do mesmo cache de tokens, para que uma renovação
   * feita por qualquer outra instância já valha aqui.
   */
  private authHeaders(server: ServerSelect): Record<string, string> {
    const token = getServerAccessToken(server.id);
    return token ? { Authorization: `Bearer ${token}` } : {};
  }
}

/** Cria o serviço já ligado ao banco da história corrente. */
export function createMediaSyncService(db: AppDrizzleClient): MediaSyncService {
  return new MediaSyncService(db);
}
