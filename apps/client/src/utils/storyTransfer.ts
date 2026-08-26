import type { FullStoryExportType } from '@keres/shared';
import {
  describeStoryIntegrityViolations,
  findStoryExportIntegrityErrors,
  FullStoryExportSchema,
  migrateStoryExport,
  StoryExportVersionError,
} from '@keres/shared';
import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';
import { reviveDates } from './reviveDates';
import type { ExtractedZipMedia } from './storyMediaBundle';
import { extractStoryZip, stripUtf8Bom } from './storyMediaBundle';
import { StoryImportError } from './StoryImportError';

export { StoryImportError };

/**
 * Delivering and reading a story's package as a *file*.
 *
 * The platform part is deliberately isolated here: exporting is "writing to a file and
 * letting the operating system decide the destination" (a share sheet on the phone, a download in the
 * browser), and neither of those two things has anything to do with the data layer. Packaging
 * media into a `.zip` (which needs to know about bytes, hash, mimeType) lives in
 * `storyMediaBundle.ts`; this file only writes/reads the resulting file.
 */

/**
 * Combining marks that `normalize('NFD')` separates from the letters.
 *
 * Assembled with escapes rather than written straight into the literal so the source file does not carry
 * invisible characters that any future edit could break without anybody noticing.
 */
const COMBINING_MARKS = new RegExp(
  '[' + String.fromCharCode(0x0300) + '-' + String.fromCharCode(0x036f) + ']',
  'g',
);

/** The title reduced to something any file system accepts. */
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
 * A file name derived from the title, safe for any file system.
 *
 * The date goes into the name because exporting the same story twice is the common case (a backup),
 * and two files with the same name in the downloads folder become a guessing game.
 */
export function buildExportFileName(storyTitle: string, now: Date = new Date()): string {
  return `${slugify(storyTitle)}-${now.toISOString().slice(0, 10)}.json`;
}

/** The name of the package with media, in the same pattern as the data export. */
export function buildExportZipFileName(storyTitle: string, now: Date = new Date()): string {
  return `${slugify(storyTitle)}-${now.toISOString().slice(0, 10)}.zip`;
}

/** The name of the story map's image file, in the same pattern as the data export. */
export function buildStoryMapFileName(storyTitle: string, now: Date = new Date()): string {
  return `${slugify(storyTitle)}-mapa-${now.toISOString().slice(0, 10)}.svg`;
}

/** The name of the relations map's image file, in the same pattern as the data export. */
export function buildCharacterRelationMapFileName(
  storyTitle: string,
  now: Date = new Date(),
): string {
  return `${slugify(storyTitle)}-relacoes-${now.toISOString().slice(0, 10)}.svg`;
}

/** The name of the Locations structure graph's image file, in the same pattern as the data export. */
export function buildLocationGraphMapFileName(storyTitle: string, now: Date = new Date()): string {
  return `${slugify(storyTitle)}-locations-${now.toISOString().slice(0, 10)}.svg`;
}

/** The narrative timeline SVG's name. */
export function buildStoryTimelineFileName(storyTitle: string, now: Date = new Date()): string {
  return `${slugify(storyTitle)}-linha-do-tempo-${now.toISOString().slice(0, 10)}.svg`;
}

/** The result of trying to deliver the file to the user. */
export interface ExportDeliveryResult {
  /** `false` when the platform offers no way at all of sharing a file. */
  delivered: boolean;
  /** The local path of the written file, when there is one. */
  uri?: string;
  fileName: string;
}

/**
 * Writes content to a file and delivers it to the user.
 *
 * On the phone, the file goes to the cache and the system's share sheet decides the destination (Drive,
 * Files, email...). Writing straight to some public folder would require storage
 * permission and would give the user less choice, not more.
 *
 * It accepts text or bytes because the simple export's `.json` and the `.zip` with media
 * share exactly this mechanism - only the content type changes.
 */
async function deliverFile(
  contents: string | Uint8Array,
  fileName: string,
  mimeType: string,
  uti: string,
): Promise<ExportDeliveryResult> {
  if (Platform.OS === 'web') {
    triggerBrowserDownload(contents, fileName, mimeType);
    return { delivered: true, fileName };
  }

  const file = new File(Paths.cache, fileName);
  // `overwrite` because exporting the same story twice on the same day produces the same
  // name, and failing on that would be a senseless error for the user.
  file.create({ overwrite: true, intermediates: true });
  file.write(contents);

  if (!(await Sharing.isAvailableAsync())) {
    return { delivered: false, uri: file.uri, fileName };
  }

  await Sharing.shareAsync(file.uri, { mimeType, dialogTitle: fileName, UTI: uti });

  return { delivered: true, uri: file.uri, fileName };
}

/** Delivers the story's data package as a `.json` (metadata only, without the media's bytes). */
export function deliverStoryExport(
  storyExport: FullStoryExportType,
  fileName: string,
): Promise<ExportDeliveryResult> {
  return deliverFile(
    JSON.stringify(storyExport, null, 2),
    fileName,
    'application/json',
    'public.json',
  );
}

/** Delivers the `.zip` package (data + media) already assembled by `buildStoryZipBytes`. */
export function deliverStoryZipExport(
  zipBytes: Uint8Array,
  fileName: string,
): Promise<ExportDeliveryResult> {
  return deliverFile(zipBytes, fileName, 'application/zip', 'public.zip-archive');
}

/** Delivers a map's image (story or relations) as an `.svg`. */
export function deliverSvgMap(svg: string, fileName: string): Promise<ExportDeliveryResult> {
  return deliverFile(svg, fileName, 'image/svg+xml', 'public.svg-image');
}

/** A browser download through a temporary link — there is no share sheet on the web. */
function triggerBrowserDownload(
  contents: string | Uint8Array,
  fileName: string,
  mimeType: string,
): void {
  // `Uint8Array`'s generic type accepts `ArrayBufferLike` (which includes `SharedArrayBuffer`), but
  // `Blob` only accepts parts backed by an `ArrayBuffer`; it is never actually a `SharedArrayBuffer`
  // here (only the web uses this path, with bytes coming from `File.bytes()`/JSZip).
  //
  // The `charset=utf-8` only goes in for textual content (JSON/SVG): it is what makes the browser open
  // the file as UTF-8 if the person drags/opens it instead of saving it, and it does not apply to a
  // binary `.zip`. Only here, on the web - the same `mimeType` also goes to `Sharing.shareAsync`
  // in the native app, whose app picker expects a MIME type without parameters.
  const blobType = typeof contents === 'string' ? `${mimeType};charset=utf-8` : mimeType;
  const blob = new Blob([contents as BlobPart], { type: blobType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

/** What `pickStoryExportFile` returns: the validated data, and the extracted media (if it came from a `.zip`). */
export interface StoryImportPayload {
  story: FullStoryExportType;
  /** Empty for a plain `.json` file - there are no media bytes to extract from it. */
  media: ExtractedZipMedia[];
}

/**
 * Opens the file picker and returns the validated package, accepting both `.json` (metadata
 * only) and `.zip` (metadata + media).
 *
 * `null` means the user cancelled - it is not an error and must not become an on-screen warning.
 *
 * The type filter is deliberately open: on several Android devices a `.json` coming from
 * another app is reported as `application/octet-stream`, and filtering by MIME type would leave the
 * file invisible in the picker with no explanation whatsoever. The content is validated below
 * either way, so a wrong file gives a clear message instead of vanishing.
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
  const isZip = asset.name?.toLowerCase().endsWith('.zip') ?? asset.mimeType === 'application/zip';

  if (isZip) {
    let bytes: Uint8Array;
    try {
      bytes = asset.file
        ? new Uint8Array(await asset.file.arrayBuffer()) // web: o seletor já entrega o Blob
        : await new File(asset.uri).bytes();
    } catch (error) {
      throw new StoryImportError(
        'unreadable',
        `Could not read ${asset.name}: ${(error as Error)?.message}`,
      );
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
    throw new StoryImportError(
      'unreadable',
      `Could not read ${asset.name}: ${(error as Error)?.message}`,
    );
  }

  let parsedJson: unknown;
  try {
    // `JSON.parse` never revives a `Date` (`FullStoryExportSchema` uses `z.date()`, which rejects a
    // string) - without this, re-importing a `.json` this very app has just exported would fail
    // validation.
    parsedJson = reviveDates(JSON.parse(stripUtf8Bom(rawContents)));
  } catch {
    throw new StoryImportError('invalid_format', `${asset.name} is not valid JSON.`);
  }

  let migrated: unknown;
  try {
    migrated = migrateStoryExport(parsedJson);
  } catch (error) {
    if (error instanceof StoryExportVersionError) {
      throw new StoryImportError('future_format_version', error.message);
    }
    throw error;
  }

  const validation = FullStoryExportSchema.safeParse(migrated);
  if (!validation.success) {
    throw new StoryImportError(
      'invalid_format',
      `${asset.name} is not a Keres story export: ${validation.error.message}`,
    );
  }

  // The schema approves each row on its own and stops there. A package can be perfectly typed and
  // still contradict itself - the same relation twice, a scene pointing at a chapter that is not in
  // the file - and the import inserts row by row without looking. Rejecting here means the user
  // learns about it while choosing the file, not through a synchronization that fails days later.
  const integrityErrors = findStoryExportIntegrityErrors(validation.data);
  if (integrityErrors.length) {
    throw new StoryImportError(
      'corrupt_content',
      `${asset.name} contradicts itself: ${describeStoryIntegrityViolations(integrityErrors)}`,
    );
  }

  return { story: validation.data, media: [] };
}
