import * as DocumentPicker from 'expo-document-picker';
import { mediaFileService, UnsupportedMediaError } from './MediaFileService';
import { GalleryService } from './storymanagement/GalleryService';

/**
 * Resultado de importar um lote de arquivos escolhidos pela pessoa.
 *
 * `galleryIds` cobre tanto mídia nova quanto duplicata resolvida: quem chama e precisa
 * vincular a mídia a uma entidade (o caso do `useEntityGalleryMedia`) usa esta lista
 * inteira, já que uma duplicata ainda é uma mídia válida para vincular.
 */
export interface ImportMediaSummary {
  added: number;
  duplicates: number;
  rejected: number;
  galleryIds: string[];
}

/**
 * Importa os arquivos escolhidos no seletor do sistema para a galeria da história.
 *
 * Mídia já presente (mesmo hash) não vira um registro novo: o endereçamento por conteúdo
 * torna a duplicata detectável, e criar outra linha só encheria a galeria de cópias da
 * mesma imagem. Compartilhado entre a tela de galeria (importação avulsa) e o hook de
 * mídia por entidade (importação + vínculo), para as duas não divergirem na lógica de
 * dedupe.
 */
export async function importPickedMediaAssets(
  galleryService: GalleryService,
  storyId: string,
  userId: string,
  assets: DocumentPicker.DocumentPickerAsset[],
): Promise<ImportMediaSummary> {
  const summary: ImportMediaSummary = { added: 0, duplicates: 0, rejected: 0, galleryIds: [] };

  for (const asset of assets) {
    try {
      const imported = await mediaFileService.importAsset(storyId, asset);
      const existing = await galleryService.getByHash(storyId, imported.hash);

      if (existing) {
        summary.duplicates += 1;
        // O registro pode existir sem arquivo local (veio do servidor e ainda não
        // baixou); nesse caso o arquivo que a pessoa acabou de escolher resolve isso.
        if (!mediaFileService.exists(existing.localPath)) {
          await galleryService.setLocalFileState(existing.id, {
            localPath: imported.localPath,
            downloadState: 'downloaded',
            thumbnailPath: imported.thumbnailPath ?? existing.thumbnailPath,
          });
        }
        summary.galleryIds.push(existing.id);
        continue;
      }

      const created = await galleryService.createGallery(userId, {
        storyId,
        mediaType: imported.mediaType,
        mimeType: imported.mimeType,
        fileName: imported.fileName,
        hash: imported.hash,
        sizeBytes: imported.sizeBytes,
        localPath: imported.localPath,
        thumbnailPath: imported.thumbnailPath,
      });
      summary.added += 1;
      summary.galleryIds.push(created.id);
    } catch (importError) {
      if (!(importError instanceof UnsupportedMediaError)) {
        console.log('Failed to import media asset:', importError);
      }
      summary.rejected += 1;
    }
  }

  return summary;
}
