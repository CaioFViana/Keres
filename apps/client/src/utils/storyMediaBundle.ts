import { extensionForMimeType, FullStoryExportSchema, FullStoryExportType, GalleryType } from '@keres/shared';
import { File } from 'expo-file-system';
import JSZip from 'jszip';
import { mediaFileService } from '../services/MediaFileService';
import { reviveDates } from './reviveDates';
import { StoryImportError } from './StoryImportError';

/**
 * Empacota uma história com a mídia da galeria, ou lê um pacote desses de volta.
 *
 * O JSON de exportação sempre carrega os *metadados* da galeria (título, hash, vínculos) -
 * isso já vinha de graça, as tabelas de galeria fazem parte do `FullStoryExportType` como
 * qualquer outra entidade. O que falta ali são os *bytes*: cada mídia é um arquivo à parte
 * no aparelho, endereçado pelo hash, e nunca esteve dentro do JSON. Este módulo é só a
 * ponte entre os dois - por isso a exportação "sem mídia" não precisa de nada daqui, é
 * literal o `FullStoryExportType` de sempre.
 *
 * Layout do .zip:
 *   story.json          - o mesmo JSON da exportação simples
 *   media/<hash>.<ext>   - cada arquivo de mídia que existia localmente no aparelho que exportou
 *
 * Sem compressão (`STORE`): a galeria é majoritariamente imagem/vídeo/áudio, formatos que já
 * chegam comprimidos - rodar DEFLATE por cima só gastaria CPU do aparelho sem reduzir nada.
 */

const STORY_JSON_ENTRY = 'story.json';
const MEDIA_DIR_PREFIX = 'media/';

/**
 * Remove um BOM UTF-8 (`﻿`) do início do texto, se houver.
 *
 * `Blob.text()` (usado no import pelo seletor da web) já descarta o BOM por especificação,
 * mas `File.text()` do `expo-file-system` (usado no import nativo) não documenta esse
 * comportamento - sem isto, o mesmo arquivo `.json`/`.zip` (por exemplo, um reexportado por
 * um editor de texto que adiciona BOM) importaria na web e falharia com "Unexpected token"
 * no aparelho.
 */
export function stripUtf8Bom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

export interface BuildZipResult {
  bytes: Uint8Array;
  /** Quantas mídias entraram no pacote, do total que a história referencia. */
  includedCount: number;
  totalCount: number;
}

/**
 * Monta os bytes do .zip para uma história já exportada (`storyService.exportFullStory`).
 *
 * Mídia que não está baixada neste aparelho (`localPath` nulo, ou o arquivo sumiu) é
 * simplesmente deixada de fora - o pacote continua útil com o resto, e quem chama recebe a
 * contagem para avisar a pessoa em vez de fingir que está tudo lá.
 */
export async function buildStoryZipBytes(storyExport: FullStoryExportType, storyId: string): Promise<BuildZipResult> {
  const zip = new JSZip();
  zip.file(STORY_JSON_ENTRY, JSON.stringify(storyExport, null, 2), { compression: 'STORE' });

  const galleryItems: GalleryType[] = storyExport.galleryItems || [];
  let includedCount = 0;

  for (const item of galleryItems) {
    const localPath = mediaFileService.localPathFor(storyId, item.hash, item.mimeType);
    if (!mediaFileService.exists(localPath)) {
      continue;
    }

    const bytes = await new File(localPath).bytes();
    const entryName = `${MEDIA_DIR_PREFIX}${item.hash}.${extensionForMimeType(item.mimeType)}`;
    zip.file(entryName, bytes, { compression: 'STORE' });
    includedCount += 1;
  }

  const bytes = await zip.generateAsync({ type: 'uint8array', compression: 'STORE' });
  return { bytes, includedCount, totalCount: galleryItems.length };
}

export interface ExtractedZipMedia {
  hash: string;
  mimeType: string;
  bytes: Uint8Array;
}

export interface ExtractedStoryZip {
  story: FullStoryExportType;
  media: ExtractedZipMedia[];
}

/**
 * Lê um .zip produzido por `buildStoryZipBytes` de volta em memória.
 *
 * O mime type de cada mídia extraída vem do `story.json` (indexado por hash), não da
 * extensão do arquivo dentro do .zip - a extensão existe só para o arquivo ter um nome
 * legível, `extensionForMimeType` já não é necessariamente 1:1 (heic/heif, jpg/jpeg).
 */
export async function extractStoryZip(bytes: Uint8Array, sourceName: string): Promise<ExtractedStoryZip> {
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(bytes);
  } catch (error) {
    throw new StoryImportError('unreadable', `Could not open ${sourceName} as a zip file: ${(error as Error)?.message}`);
  }

  const storyEntry = zip.file(STORY_JSON_ENTRY);
  if (!storyEntry) {
    throw new StoryImportError('invalid_format', `${sourceName} does not contain a ${STORY_JSON_ENTRY} entry.`);
  }

  let parsedJson: unknown;
  try {
    // `JSON.parse` nunca revive `Date` - mesmo cuidado de `pickStoryExportFile` com o `.json`
    // solto, senão a validação abaixo rejeitaria toda data como string.
    parsedJson = reviveDates(JSON.parse(stripUtf8Bom(await storyEntry.async('string'))));
  } catch {
    throw new StoryImportError('invalid_format', `${sourceName}'s ${STORY_JSON_ENTRY} is not valid JSON.`);
  }

  const validation = FullStoryExportSchema.safeParse(parsedJson);
  if (!validation.success) {
    throw new StoryImportError('invalid_format', `${sourceName} is not a Keres story export: ${validation.error.message}`);
  }

  const story = validation.data;
  const mimeTypeByHash = new Map((story.galleryItems || []).map((item) => [item.hash, item.mimeType]));

  const media: ExtractedZipMedia[] = [];
  const mediaEntries = zip.file(new RegExp(`^${MEDIA_DIR_PREFIX}`));
  for (const entry of mediaEntries) {
    if (entry.dir) {
      continue;
    }
    const hash = entry.name.slice(MEDIA_DIR_PREFIX.length).split('.')[0];
    const mimeType = mimeTypeByHash.get(hash);
    if (!mimeType) {
      // Entrada que o story.json não referencia (pacote adulterado ou de uma versão
      // diferente); ignorar em vez de falhar a importação inteira por causa dela.
      continue;
    }
    media.push({ hash, mimeType, bytes: await entry.async('uint8array') });
  }

  return { story, media };
}
