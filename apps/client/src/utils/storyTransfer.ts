import { FullStoryExportSchema, FullStoryExportType } from '@keres/shared';
import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

/**
 * Entrega e leitura do pacote de uma história como *arquivo*.
 *
 * A parte de plataforma fica isolada aqui de propósito: exportar é "escrever num arquivo e
 * passar para o sistema operacional decidir o destino" (share sheet no celular, download no
 * navegador), e nenhuma dessas duas coisas tem a ver com a camada de dados.
 */

/** Erro de importação com causa que o usuário consegue entender e agir. */
export class StoryImportError extends Error {
  readonly reason: 'unreadable' | 'invalid_format';

  constructor(reason: 'unreadable' | 'invalid_format', message: string) {
    super(message);
    this.name = 'StoryImportError';
    this.reason = reason;
  }
}

/**
 * Marcas combinantes que o `normalize('NFD')` separa das letras.
 *
 * Montado com escapes em vez de escrito direto no literal para o arquivo-fonte não carregar
 * caracteres invisíveis que qualquer edição futura pode quebrar sem ninguém notar.
 */
const COMBINING_MARKS = new RegExp('[\u0300-\u036f]', 'g');

/**
 * Nome de arquivo derivado do título, seguro para qualquer sistema de arquivos.
 *
 * A data entra no nome porque exportar a mesma história duas vezes é o caso comum (backup),
 * e dois arquivos com o mesmo nome na pasta de downloads viram uma adivinhação.
 */
export function buildExportFileName(storyTitle: string, now: Date = new Date()): string {
  const slug = storyTitle
    .normalize('NFD')
    .replace(COMBINING_MARKS, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
    .slice(0, 60);

  const datePart = now.toISOString().slice(0, 10);
  return `${slug || 'story'}-${datePart}.json`;
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
 * Escreve o pacote em arquivo e entrega ao usuário.
 *
 * No celular, o arquivo vai para o cache e o share sheet do sistema decide o destino (Drive,
 * Arquivos, e-mail...). Gravar direto em alguma pasta pública exigiria permissão de
 * armazenamento e daria menos escolha ao usuário, não mais.
 */
export async function deliverStoryExport(
  storyExport: FullStoryExportType,
  fileName: string
): Promise<ExportDeliveryResult> {
  const contents = JSON.stringify(storyExport, null, 2);

  if (Platform.OS === 'web') {
    triggerBrowserDownload(contents, fileName);
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

  await Sharing.shareAsync(file.uri, {
    mimeType: 'application/json',
    dialogTitle: fileName,
    UTI: 'public.json',
  });

  return { delivered: true, uri: file.uri, fileName };
}

/** Download no navegador via link temporário — não existe share sheet na web. */
function triggerBrowserDownload(contents: string, fileName: string): void {
  const blob = new Blob([contents], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

/**
 * Abre o seletor de arquivos e devolve o pacote validado.
 *
 * `null` significa que o usuário cancelou - não é erro e não deve virar aviso na tela.
 *
 * O filtro de tipo é aberto de propósito: em vários aparelhos Android um `.json` vindo de
 * outro app é reportado como `application/octet-stream`, e filtrar por `application/json`
 * deixaria o arquivo invisível no seletor sem nenhuma explicação. O conteúdo é validado
 * abaixo de qualquer forma, então um arquivo errado dá uma mensagem clara em vez de sumir.
 */
export async function pickStoryExportFile(): Promise<FullStoryExportType | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: '*/*',
    copyToCacheDirectory: true,
    multiple: false,
  });

  if (result.canceled || !result.assets?.length) {
    return null;
  }

  const asset = result.assets[0];

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
    parsedJson = JSON.parse(rawContents);
  } catch {
    throw new StoryImportError('invalid_format', `${asset.name} is not valid JSON.`);
  }

  const validation = FullStoryExportSchema.safeParse(parsedJson);
  if (!validation.success) {
    throw new StoryImportError('invalid_format', `${asset.name} is not a Keres story export: ${validation.error.message}`);
  }

  return validation.data;
}
