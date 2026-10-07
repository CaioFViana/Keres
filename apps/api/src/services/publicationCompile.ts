import {
  compileStoryReader,
  ManuscriptOptionsSchema,
  ReaderOptionsSchema,
  type FullStoryExportType,
  type ManuscriptFormat,
  type ManuscriptOptions,
  type ManuscriptOptionsInput,
  type ReaderOptionsInput,
} from '@keres/shared';
import { compileStoryManuscript } from '@keres/shared/manuscript/export';
import { eq } from 'drizzle-orm';
import { db } from '../db';
import { users } from '../db/schema';
import { AppError } from '../utils/errors';
import { compileInputOf } from './publicationCompileInput';
import { withScenePages, type ReadMediaBytes } from './publicationPages';
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
    const input = withSceneSongs(
      await withScenePages(
        compileInputOf(storyExport),
        storyExport,
        { format: 'reader', arcId: options.arcId },
        readMedia,
      ),
      storyExport,
      options,
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
