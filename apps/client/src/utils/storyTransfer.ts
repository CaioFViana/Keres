import { FullStoryExportSchema, FullStoryExportType } from '@keres/shared';
import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';
import { reviveDates } from './reviveDates';
import { ExtractedZipMedia, extractStoryZip } from './storyMediaBundle';
import { StoryImportError } from './StoryImportError';

export { StoryImportError };

/**
 * Entrega e leitura do pacote de uma história como *arquivo*.
 *
 * A parte de plataforma fica isolada aqui de propósito: exportar é "escrever num arquivo e
 * passar para o sistema operacional decidir o destino" (share sheet no celular, download no
 * navegador), e nenhuma dessas duas coisas tem a ver com a camada de dados. O empacotamento
 * de mídia em `.zip` (que precisa saber sobre bytes, hash, mimeType) fica em
 * `storyMediaBundle.ts`; este arquivo só escreve/lê o arquivo resultante.
 */

/**
 * Marcas combinantes que o `normalize('NFD')` separa das letras.
 *
 * Montado com escapes em vez de escrito direto no literal para o arquivo-fonte não carregar
 * caracteres invisíveis que qualquer edição futura pode quebrar sem ninguém notar.
 */
const COMBINING_MARKS = new RegExp('[' + String.fromCharCode(0x0300) + '-' + String.fromCharCode(0x036f) + ']', 'g');

/** Título reduzido a algo que qualquer sistema de arquivos aceita. */
function slugify(storyTitle: string): string {
  const slug = storyTitle
    .normalize('NFD')
    .replace(COMBINING_MARKS, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
    .slice(0, 60);

  return slug || 'story';
}

/**
 * Nome de arquivo derivado do título, seguro para qualquer sistema de arquivos.
 *
 * A data entra no nome porque exportar a mesma história duas vezes é o caso comum (backup),
 * e dois arquivos com o mesmo nome na pasta de downloads viram uma adivinhação.
 */
export function buildExportFileName(storyTitle: string, now: Date = new Date()): string {
  return `${slugify(storyTitle)}-${now.toISOString().slice(0, 10)}.json`;
}

/** Nome do pacote com mídia, no mesmo padrão da exportação de dados. */
export function buildExportZipFileName(storyTitle: string, now: Date = new Date()): string {
  return `${slugify(storyTitle)}-${now.toISOString().slice(0, 10)}.zip`;
}

/** Nome do arquivo de imagem do mapa da história, no mesmo padrão da exportação de dados. */
export function buildStoryMapFileName(storyTitle: string, now: Date = new Date()): string {
  return `${slugify(storyTitle)}-mapa-${now.toISOString().slice(0, 10)}.svg`;
}

/** Nome do arquivo de imagem do mapa de relações, no mesmo padrão da exportação de dados. */
export function buildCharacterRelationMapFileName(storyTitle: string, now: Date = new Date()): string {
  return `${slugify(storyTitle)}-relacoes-${now.toISOString().slice(0, 10)}.svg`;
}

/** Resultado da tentativa de entregar o arquivo ao usuário. */
export interface ExportDeliveryResult {
  /** `false` quando a plataforma não oferece nenhuma forma de compartilhar arquivo. */
  delivered: boolean;
  /** Caminho local do arquivo escrito, quando houver. */
  uri?: string;
  fileName: string;
}

/**
 * Escreve conteúdo em arquivo e entrega ao usuário.
 *
 * No celular, o arquivo vai para o cache e o share sheet do sistema decide o destino (Drive,
 * Arquivos, e-mail...). Gravar direto em alguma pasta pública exigiria permissão de
 * armazenamento e daria menos escolha ao usuário, não mais.
 *
 * Aceita texto ou bytes porque o `.json` da exportação simples e o `.zip` com mídia
 * compartilham exatamente este mecanismo - só o tipo de conteúdo muda.
 */
async function deliverFile(
  contents: string | Uint8Array,
  fileName: string,
  mimeType: string,
  uti: string
): Promise<ExportDeliveryResult> {
  if (Platform.OS === 'web') {
    triggerBrowserDownload(contents, fileName, mimeType);
    return { delivered: true, fileName };
  }

  const file = new File(Paths.cache, fileName);
  // `overwrite` porque exportar a mesma história duas vezes no mesmo dia produz o mesmo
  // nome, e falhar nisso seria um erro sem sentido para o usuário.
  file.create({ overwrite: true, intermediates: true });
  file.write(contents);

  if (!(await Sharing.isAvailableAsync())) {
    return { delivered: false, uri: file.uri, fileName };
  }

  await Sharing.shareAsync(file.uri, { mimeType, dialogTitle: fileName, UTI: uti });

  return { delivered: true, uri: file.uri, fileName };
}

/** Entrega o pacote de dados da história como `.json` (metadados só, sem os bytes da mídia). */
export function deliverStoryExport(
  storyExport: FullStoryExportType,
  fileName: string
): Promise<ExportDeliveryResult> {
  return deliverFile(JSON.stringify(storyExport, null, 2), fileName, 'application/json', 'public.json');
}

/** Entrega o pacote `.zip` (dados + mídia) já montado por `buildStoryZipBytes`. */
export function deliverStoryZipExport(
  zipBytes: Uint8Array,
  fileName: string
): Promise<ExportDeliveryResult> {
  return deliverFile(zipBytes, fileName, 'application/zip', 'public.zip-archive');
}

/** Entrega a imagem de um mapa (história ou relações) como `.svg`. */
export function deliverSvgMap(svg: string, fileName: string): Promise<ExportDeliveryResult> {
  return deliverFile(svg, fileName, 'image/svg+xml', 'public.svg-image');
}

/** Download no navegador via link temporário — não existe share sheet na web. */
function triggerBrowserDownload(contents: string | Uint8Array, fileName: string, mimeType: string): void {
  // `Uint8Array`'s tipo genérico aceita `ArrayBufferLike` (inclui `SharedArrayBuffer`), mas
  // `Blob` só aceita partes apoiadas em `ArrayBuffer`; nunca é de fato um `SharedArrayBuffer`
  // aqui (só web usa este caminho, com bytes vindos de `File.bytes()`/JSZip).
  const blob = new Blob([contents as BlobPart], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

/** O que `pickStoryExportFile` devolve: os dados validados, e a mídia extraída (se veio de um `.zip`). */
export interface StoryImportPayload {
  story: FullStoryExportType;
  /** Vazio para um arquivo `.json` puro - não há bytes de mídia para extrair dele. */
  media: ExtractedZipMedia[];
}

/**
 * Abre o seletor de arquivos e devolve o pacote validado, aceitando tanto `.json` (só
 * metadados) quanto `.zip` (metadados + mídia).
 *
 * `null` significa que o usuário cancelou - não é erro e não deve virar aviso na tela.
 *
 * O filtro de tipo é aberto de propósito: em vários aparelhos Android um `.json` vindo de
 * outro app é reportado como `application/octet-stream`, e filtrar por tipo MIME deixaria o
 * arquivo invisível no seletor sem nenhuma explicação. O conteúdo é validado abaixo de
 * qualquer forma, então um arquivo errado dá uma mensagem clara em vez de sumir.
 */
export async function pickStoryExportFile(): Promise<StoryImportPayload | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: '*/*',
    copyToCacheDirectory: true,
    multiple: false,
  });

  if (result.canceled || !result.assets?.length) {
    return null;
  }

  const asset = result.assets[0];
  const isZip = asset.name?.toLowerCase().endsWith('.zip')
    ?? (asset.mimeType === 'application/zip');

  if (isZip) {
    let bytes: Uint8Array;
    try {
      bytes = asset.file
        ? new Uint8Array(await asset.file.arrayBuffer()) // web: o seletor já entrega o Blob
        : await new File(asset.uri).bytes();
    } catch (error) {
      throw new StoryImportError('unreadable', `Could not read ${asset.name}: ${(error as Error)?.message}`);
    }

    const { story, media } = await extractStoryZip(bytes, asset.name || 'file.zip');
    return { story, media };
  }

  let rawContents: string;
  try {
    rawContents = asset.file
      ? await asset.file.text() // web: o seletor já entrega o Blob
      : await new File(asset.uri).text();
  } catch (error) {
    throw new StoryImportError('unreadable', `Could not read ${asset.name}: ${(error as Error)?.message}`);
  }

  let parsedJson: unknown;
  try {
    // `JSON.parse` nunca revive `Date` (`FullStoryExportSchema` usa `z.date()`, que rejeita
    // string) - sem isto, reimportar um `.json` que este mesmo app acabou de exportar falharia
    // na validação.
    parsedJson = reviveDates(JSON.parse(rawContents));
  } catch {
    throw new StoryImportError('invalid_format', `${asset.name} is not valid JSON.`);
  }

  const validation = FullStoryExportSchema.safeParse(parsedJson);
  if (!validation.success) {
    throw new StoryImportError('invalid_format', `${asset.name} is not a Keres story export: ${validation.error.message}`);
  }

  return { story: validation.data, media: [] };
}
