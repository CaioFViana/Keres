import JSZip from 'jszip';
import { extensionForMimeType } from '../schemas/GallerySchemas';
import type { FullStoryExportType } from '../schemas/FullStorySchemas';
import type { GalleryType } from '../schemas/GallerySchemas';

/**
 * O empacotamento de uma história com a mídia da galeria, na forma que cliente e servidor
 * compartilham.
 *
 * O JSON de exportação sempre carregou os *metadados* da galeria (título, hash, vínculos) -
 * as tabelas de galeria fazem parte do `FullStoryExportType` como qualquer outra entidade. O
 * que falta ali são os *bytes*: cada mídia é um arquivo à parte, endereçado pelo hash. Este
 * módulo é só a ponte entre os dois.
 *
 * Layout do .zip:
 *   story.json          - o mesmo JSON da exportação simples
 *   media/<hash>.<ext>  - cada arquivo de mídia que quem empacotou conseguiu resolver
 *
 * Mora em `@keres/shared` porque os dois lados precisam produzir o *mesmo* arquivo: o app
 * exporta do aparelho (bytes vindos do disco local) e a API publica no Showcase (bytes vindos
 * do armazenamento de mídia). Só o resolvedor muda; o formato não pode mudar, senão um pacote
 * baixado do site não importaria de volta no app.
 *
 * Sem compressão (`STORE`): a galeria é majoritariamente imagem/vídeo/áudio, formatos que já
 * chegam comprimidos - rodar DEFLATE por cima só gastaria CPU sem reduzir nada.
 */

export const STORY_JSON_ENTRY = 'story.json';
export const MEDIA_DIR_PREFIX = 'media/';

/**
 * Devolve os bytes de uma mídia, ou `null` quando quem empacota não tem esse arquivo (não
 * baixado no aparelho, ou ausente do armazenamento do servidor).
 */
export type MediaByteResolver = (item: GalleryType) => Promise<Uint8Array | null>;

export interface BuildStoryZipResult {
  bytes: Uint8Array;
  /** Quantas mídias entraram no pacote, do total que a história referencia. */
  includedCount: number;
  totalCount: number;
}

/**
 * Monta os bytes do .zip para uma história já exportada.
 *
 * Mídia que o resolvedor não encontra é simplesmente deixada de fora - o pacote continua útil
 * com o resto, e quem chama recebe a contagem para avisar a pessoa em vez de fingir que está
 * tudo lá.
 */
export async function buildStoryZipBytes(
  storyExport: FullStoryExportType,
  resolve: MediaByteResolver,
): Promise<BuildStoryZipResult> {
  const zip = new JSZip();
  zip.file(STORY_JSON_ENTRY, JSON.stringify(storyExport, null, 2), { compression: 'STORE' });

  const galleryItems: GalleryType[] = storyExport.galleryItems || [];
  let includedCount = 0;

  for (const item of galleryItems) {
    const bytes = await resolve(item);
    if (!bytes) {
      continue;
    }
    const entryName = `${MEDIA_DIR_PREFIX}${item.hash}.${extensionForMimeType(item.mimeType)}`;
    zip.file(entryName, bytes, { compression: 'STORE' });
    includedCount += 1;
  }

  const bytes = await zip.generateAsync({ type: 'uint8array', compression: 'STORE' });
  return { bytes, includedCount, totalCount: galleryItems.length };
}
