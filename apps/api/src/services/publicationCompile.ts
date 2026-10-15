import {
  compileStoryReader,
  FORMAT_META,
  ManuscriptFormatSchema,
  ManuscriptOptionsSchema,
  MAX_MANUSCRIPT_BYTES,
  ReaderOptionsSchema,
  type FullStoryExportType,
  type ManuscriptFormat,
  type ManuscriptOptions,
  type ManuscriptOptionsInput,
  type ReaderOptionsInput,
} from '@keres/shared';
import { compileStoryManuscript } from '@keres/shared/manuscript/export';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { users } from '@/db/schema';
import { AppError } from '@/utils/errors';
import { compileInputOf } from './publicationCompileInput';
import { withCover, withScenePages, type ReadMediaBytes } from './publicationPages';
import { withSceneSongs } from './publicationSongs';
import { mediaStorageService } from './MediaStorageService';
import { publicationPdfFontMatrices } from './publicationPdfFonts';

/**
 * Turning the owner's choices into a manuscript or an online reader: validating the options against
 * the story, picking the credited author, and compiling from the already-fetched export. Split from
 * the service, which is about versions, blobs and the showcase, not about how a book is made.
 */

/**
 * Validates the requested manuscript options against the story, without compiling anything.
 *
 * A branching story is exported whole, as a gamebook, so it takes no route. The arc, when one is
 * asked, must be one of this story's live ones, read from the same export the manuscript will be
 * compiled from.
 */
export function parseManuscriptOptions(
  storyExport: FullStoryExportType,
  manuscript: ManuscriptOptionsInput,
): ManuscriptOptions {
  const parsed = ManuscriptOptionsSchema.safeParse(manuscript);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join('.') || 'manuscript'}: ${issue.message}`)
      .join('; ');
    throw new AppError(400, `Invalid manuscript options: ${details}.`);
  }
  assertArcBelongs(storyExport, parsed.data.arcId);
  return withoutProducerNotes(parsed.data);
}

/**
 * A publication carries the story to its readers, not the writer's own notes about it: the music of a
 * scene written as cues or as Fountain notes names references from the Gallery and says how a piece
 * comes in, so a publication never writes either, whatever the request says.
 */
function withoutProducerNotes<T extends { screenplay?: object }>(options: T): T {
  return {
    ...options,
    includeMusicCues: false,
    ...(options.screenplay
      ? { screenplay: { ...options.screenplay, includeMusicNotes: false } }
      : {}),
  };
}

/** The reader takes the manuscript's choices (arc, names, typography...) and its own words. */
export function parseReaderOptions(
  storyExport: FullStoryExportType,
  reader: ReaderOptionsInput,
): ReaderOptionsInput {
  const parsed = ReaderOptionsSchema.safeParse(reader);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join('.') || 'reader'}: ${issue.message}`)
      .join('; ');
    throw new AppError(400, `Invalid reader options: ${details}.`);
  }
  assertArcBelongs(storyExport, parsed.data.arcId);
  return withoutProducerNotes(parsed.data);
}

export function assertArcBelongs(
  storyExport: FullStoryExportType,
  arcId: string | undefined,
): void {
  if (!arcId) return;
  const belongs = (storyExport.storyArcs ?? []).some(
    (arc) => arc.id === arcId && arc.storyId === storyExport.story.id && !arc.isDeleted,
  );
  if (!belongs) {
    throw new AppError(400, `Arc "${arcId}" does not belong to this story.`);
  }
}

/**
 * Client-compiled uploads: the device compiled the manuscript or the reader itself and the server
 * stores the bytes as sent, without compiling. Nothing here trusts the bytes: the shared size cap,
 * the file extension and MIME type against the requested format, and a magic-byte sniff all run
 * before the first blob is stored. There is no client digest precedent (unlike media uploads), so
 * the magic bytes stand in for the hash check.
 */

/** What bytes a manuscript format is made of: `%PDF`, a `PK` zip, or text. */
function manuscriptByteKindOf(format: ManuscriptFormat): 'pdf' | 'zip' | 'text' {
  if (format === 'pdf' || format === 'screenplay-pdf') return 'pdf';
  if (format === 'docx' || format === 'epub') return 'zip';
  return 'text';
}

/** What the bytes look like from their first bytes: PDF and zip by magic, text by having no NUL. */
function sniffByteKind(bytes: Uint8Array): 'pdf' | 'zip' | 'text' | 'binary' | 'empty' {
  if (bytes.byteLength === 0) return 'empty';
  if (
    bytes.byteLength >= 4 &&
    bytes[0] === 0x25 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x44 &&
    bytes[3] === 0x46
  ) {
    return 'pdf';
  }
  if (bytes.byteLength >= 2 && bytes[0] === 0x50 && bytes[1] === 0x4b) {
    return 'zip';
  }
  const head = bytes.subarray(0, Math.min(bytes.byteLength, 8192));
  for (let index = 0; index < head.byteLength; index++) {
    if (head[index] === 0) return 'binary';
  }
  return 'text';
}

/**
 * A MIME type's byte kind, or `null` when it says nothing about the bytes. Absent and generic
 * (`application/octet-stream`) senders say nothing, and so do types outside the manuscript's world
 * (a wrong charger, not a wrong file): the extension and the sniff below carry those cases.
 */
function mimeByteKindOf(mimeType: string | null | undefined): 'pdf' | 'zip' | 'text' | null {
  const mime = (mimeType ?? '').split(';')[0].trim().toLowerCase();
  if (!mime || mime === 'application/octet-stream') return null;
  if (mime === 'application/pdf') return 'pdf';
  if (
    mime === 'application/zip' ||
    mime === 'application/epub+zip' ||
    mime.startsWith('application/vnd.openxmlformats')
  ) {
    return 'zip';
  }
  if (mime.startsWith('text/')) return 'text';
  return null;
}

/** The shared manuscript cap for uploads: 413, not 400 - the bytes are fine, there are too many. */
function assertUploadSize(kind: 'manuscript' | 'reader', bytes: Uint8Array): void {
  if (bytes.byteLength > MAX_MANUSCRIPT_BYTES) {
    const what = kind === 'manuscript' ? 'Manuscript' : 'Reader';
    throw new AppError(
      413,
      `${what} exceeds the ${MAX_MANUSCRIPT_BYTES}-byte limit (${bytes.byteLength} bytes).`,
    );
  }
  if (bytes.byteLength === 0) {
    throw new AppError(400, `The uploaded ${kind} is empty.`);
  }
}

function assertHtmlDocument(bytes: Uint8Array, what: string): void {
  if (sniffByteKind(bytes) !== 'text' || !bytes.subarray(0, 1024).includes(0x3c)) {
    throw new AppError(400, `The uploaded ${what} is not an HTML document.`);
  }
}

/**
 * Validates client-compiled manuscript bytes against the requested format, without compiling.
 * `pdf` and `screenplay-pdf` share the `.pdf` extension, so the name alone never tells a paged
 * screenplay from a plain paged manuscript - the sniff below does.
 */
export function validateUploadedManuscript(
  bytes: Uint8Array,
  format: ManuscriptFormat,
  filename?: string | null,
  mimeType?: string | null,
): { bytes: Uint8Array; format: ManuscriptFormat } {
  const parsed = ManuscriptFormatSchema.safeParse(format);
  if (!parsed.success) {
    throw new AppError(400, `Invalid manuscript format "${String(format)}".`);
  }
  assertUploadSize('manuscript', bytes);
  const meta = FORMAT_META[parsed.data];
  if (filename) {
    const extension = filename.split('.').pop()?.toLowerCase() ?? '';
    if (extension !== meta.extension) {
      throw new AppError(
        400,
        `The uploaded manuscript file extension ".${extension}" does not match the "${parsed.data}" format (".${meta.extension}").`,
      );
    }
  }
  const expectedKind = manuscriptByteKindOf(parsed.data);
  const mimeKind = mimeByteKindOf(mimeType);
  if (mimeKind && mimeKind !== expectedKind) {
    throw new AppError(
      400,
      `The uploaded manuscript MIME type "${mimeType}" does not match the "${parsed.data}" format (${meta.mimeType}).`,
    );
  }
  const actualKind = sniffByteKind(bytes);
  if (actualKind !== expectedKind) {
    throw new AppError(
      400,
      `The uploaded manuscript is not ${expectedKind === 'text' ? 'text' : `a ${expectedKind.toUpperCase()}`} as the "${parsed.data}" format requires.`,
    );
  }
  if (parsed.data === 'html') {
    assertHtmlDocument(bytes, 'manuscript');
  }
  return { bytes, format: parsed.data };
}

/** Validates a client-compiled reader page: always one self-contained HTML document. */
export function validateUploadedReader(
  bytes: Uint8Array,
  filename?: string | null,
  mimeType?: string | null,
): { bytes: Uint8Array } {
  assertUploadSize('reader', bytes);
  if (filename) {
    const extension = filename.split('.').pop()?.toLowerCase() ?? '';
    if (extension !== 'html' && extension !== 'htm') {
      throw new AppError(
        400,
        `The uploaded reader file extension ".${extension}" must be ".html".`,
      );
    }
  }
  const mimeKind = mimeByteKindOf(mimeType);
  if (mimeKind && mimeKind !== 'text') {
    throw new AppError(
      400,
      `The uploaded reader MIME type "${mimeType}" must be HTML ("text/html").`,
    );
  }
  assertHtmlDocument(bytes, 'reader');
  return { bytes };
}

/**
 * Who is credited when the publisher did not say: the work's own author, then the story's, then
 * the owner's handle.
 */
export function defaultAuthor(
  storyExport: FullStoryExportType,
  arcId: string | undefined,
  ownerHandle: string | null,
): string | null {
  const arc = arcId ? (storyExport.storyArcs ?? []).find((row) => row.id === arcId) : undefined;
  return arc?.author?.trim() || storyExport.story.author?.trim() || ownerHandle;
}

/** The owner's `@handle`, the last resort when nobody wrote an author anywhere. */
export async function ownerHandleOf(userId: string): Promise<string | null> {
  const owner = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { tag: true },
  });
  return owner?.tag ? `@${owner.tag}` : null;
}

/** The bytes stored behind a Gallery hash, or `null` when the server does not hold them. */
export const readStoredMedia: ReadMediaBytes = async (hash) => {
  const stored = await mediaStorageService.read(hash);
  if (!stored) return null;
  const body = stored.body;
  // A Blob or a Bun file reads itself; anything else is a stream.
  const buffer =
    'arrayBuffer' in body && typeof body.arrayBuffer === 'function'
      ? await body.arrayBuffer()
      : await new Response(body as ReadableStream<Uint8Array>).arrayBuffer();
  return new Uint8Array(buffer);
};

/** Compiles the manuscript from the already-fetched export. Oversized output is the caller's fault. */
export async function compileManuscript(
  storyExport: FullStoryExportType,
  options: ManuscriptOptions,
  ownerHandle: string | null,
  readMedia: ReadMediaBytes = readStoredMedia,
): Promise<{ bytes: Uint8Array; format: ManuscriptFormat }> {
  try {
    const compiled = await compileStoryManuscript(
      await withCover(
        withSceneSongs(
          await withScenePages(
            compileInputOf(storyExport),
            storyExport,
            { format: options.format, arcId: options.arcId },
            readMedia,
          ),
          storyExport,
          options,
        ),
        storyExport,
        { format: options.format, arcId: options.arcId, includeCover: options.includeCover },
        readMedia,
      ),
      // The book's author defaults to the work's, then the story's, as on the device.
      {
        ...options,
        author:
          options.author === undefined
            ? defaultAuthor(storyExport, options.arcId, ownerHandle)
            : options.author,
      },
      // Serif matrices when the image carries them (undefined = Times, same bytes as ever).
      await publicationPdfFontMatrices(),
    );
    return { bytes: compiled.bytes, format: options.format };
  } catch (error) {
    // The compiler throws a plain Error for input-caused failures (output past the
    // byte cap). Those are 400s; anything else (a renderer bug) keeps bubbling as a 500.
    if (error instanceof Error && /exceeds the .* limit/.test(error.message)) {
      throw new AppError(400, error.message);
    }
    throw error;
  }
}

/** Compiles the online reader page from the same export, with the same guarantees. */
export async function compileReader(
  storyExport: FullStoryExportType,
  options: ReaderOptionsInput,
  ownerHandle: string | null,
  readMedia: ReadMediaBytes = readStoredMedia,
): Promise<{ bytes: Uint8Array }> {
  try {
    const input = await withCover(
      withSceneSongs(
        await withScenePages(
          compileInputOf(storyExport),
          storyExport,
          { format: 'reader', arcId: options.arcId },
          readMedia,
        ),
        storyExport,
        options,
      ),
      storyExport,
      { format: 'reader', arcId: options.arcId, includeCover: options.includeCover },
      readMedia,
    );
    return compileStoryReader(input, {
      ...options,
      author:
        options.author === undefined
          ? defaultAuthor(storyExport, options.arcId, ownerHandle)
          : options.author,
    });
  } catch (error) {
    if (error instanceof Error && /exceeds the .* limit/.test(error.message)) {
      throw new AppError(400, error.message);
    }
    throw error;
  }
}
