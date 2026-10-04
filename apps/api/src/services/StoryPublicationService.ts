import {
  buildPublicationLabel,
  compileStoryReader,
  CURRENT_STORY_FORMAT_VERSION,
  FORMAT_META,
  ManuscriptOptionsSchema,
  ReaderOptionsSchema,
  type FullStoryExportType,
  type ManuscriptFormat,
  type ManuscriptOptions,
  type ManuscriptOptionsInput,
  type PublicationLabelMode,
  type ReaderOptionsInput,
  type ShowcaseVisibility,
  type StoryPublicationSnapshot,
} from '@keres/shared';
import { compileStoryManuscript } from '@keres/shared/manuscript/export';
import { buildStoryZipBytes } from '@keres/shared/utils/storyZip';
import { and, desc, eq, inArray } from 'drizzle-orm';
import { ulid } from 'ulid';
import { hashPassword } from '../config/bcrypt';
import { db } from '../db';
import { stories, storyPermissions, storyPublications, storyShowcaseEntries } from '../db/schema';
import { emitUserEvent } from '../modules/webSocket/webSocket.route';
import { AppError } from '../utils/errors';
import { createExclusiveGate } from '../utils/exclusive';
import { mediaStorageService } from './MediaStorageService';
import { publicationPdfFontMatrices } from './publicationPdfFonts';
import { publicationStorageService } from './PublicationStorageService';
import { showcaseSettingsService } from './ShowcaseSettingsService';
import { compileInputOf } from './publicationCompileInput';
import { TierLimitExceededError, tierEnforcementService } from './TierEnforcementService';
import { StoryExportImportService } from './StoryExportImportService';

/** One manuscript or reader is compiled at a time: the memory a book costs is not worth multiplying. */
const compileGate = createExclusiveGate();

/**
 * How many versions of a story the server keeps. Publishing the sixth deletes the oldest, package
 * included - the full history belongs to the author, in the app; here it is only the showcase.
 */
export const MAX_PUBLICATIONS_PER_STORY = 5;

async function blobFromMediaStorage(hash: string): Promise<Uint8Array | null> {
  const stored = await mediaStorageService.read(hash);
  if (!stored) {
    return null;
  }
  const body = stored.body;
  const buffer =
    body instanceof Blob
      ? await body.arrayBuffer()
      : await new Response(body as ReadableStream<Uint8Array>).arrayBuffer();
  return new Uint8Array(buffer);
}

export class StoryPublicationService {
  constructor(private readonly exportImportService = new StoryExportImportService()) {}

  private async assertShowcaseEnabled(): Promise<void> {
    if (!(await showcaseSettingsService.isEnabled())) {
      throw new AppError(403, 'The showcase is disabled on this server.');
    }
  }

  /**
   * Only the owner publishes. A `writer` permission is not enough: publishing exposes the story to the
   * world, and that is the owner's decision - the same line `SyncService` draws for editing/deleting the
   * Story entity itself.
   */
  private async assertOwnership(userId: string, storyId: string) {
    const story = await db.query.stories.findFirst({ where: eq(stories.id, storyId) });
    if (!story || story.isDeleted) {
      throw new AppError(404, 'Story not found.');
    }
    if (story.userId !== userId) {
      throw new AppError(403, 'Only the owner of a story can publish it.');
    }
    return story;
  }

  private snapshotOf(story: typeof stories.$inferSelect): StoryPublicationSnapshot {
    return {
      title: story.title,
      description: story.description,
      genre: story.genre,
      language: story.language,
      author: story.author,
      type: story.type,
      theme: story.theme,
      isNsfw: story.isNsfw,
    };
  }

  /**
   * The owner + everybody with a live permission on the story.
   *
   * The owner is included because the event also serves for *their other* devices to refresh the version
   * list - not only to notify somebody. Whether that becomes an on-screen notice is the client's call,
   * and it silences stories the person owns: they have just published, they do not need to be told (see
   * `PublicationService.performPublicationSync`).
   */
  private async audienceFor(storyId: string, ownerUserId: string): Promise<string[]> {
    const collaborators = await db
      .select({ userId: storyPermissions.userId })
      .from(storyPermissions)
      .where(and(eq(storyPermissions.storyId, storyId), eq(storyPermissions.isDeleted, false)));
    return [...new Set([ownerUserId, ...collaborators.map((row) => row.userId)])];
  }

  private async notifyAudience(storyId: string, ownerUserId: string): Promise<void> {
    for (const userId of await this.audienceFor(storyId, ownerUserId)) {
      emitUserEvent(userId, { type: 'story.published', storyId });
    }
  }

  /**
   * Runs the publication transaction, removing the already-written package if it does not go through.
   *
   * The .zip is written before the transaction on purpose (see `publish`), so the error path has to undo
   * that explicitly - otherwise a refused publication, because of a repeated version name for instance,
   * would leave a file no row references.
   */
  private async runPublishTransaction<T>(
    work: Parameters<typeof db.transaction<T>>[0],
    onFailure: () => Promise<void>,
  ): Promise<T> {
    try {
      return await db.transaction(work);
    } catch (error) {
      await onFailure().catch(() => undefined);
      throw error;
    }
  }

  /**
   * Validates the requested manuscript options against the story, without compiling anything.
   *
   * A branching story is exported whole, as a gamebook, so it takes no route. The arc, when one is
   * asked, must be one of this story's live ones, read from the same export the manuscript will be
   * compiled from.
   */
  private parseManuscriptOptions(
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
    this.assertArcBelongs(storyExport, parsed.data.arcId);
    return parsed.data;
  }

  /** The reader takes the manuscript's choices (arc, names, typography...) and its own words. */
  private parseReaderOptions(
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
    this.assertArcBelongs(storyExport, parsed.data.arcId);
    return parsed.data;
  }

  private assertArcBelongs(storyExport: FullStoryExportType, arcId: string | undefined): void {
    if (!arcId) return;
    const belongs = (storyExport.storyArcs ?? []).some(
      (arc) => arc.id === arcId && arc.storyId === storyExport.story.id && !arc.isDeleted,
    );
    if (!belongs) {
      throw new AppError(400, `Arc "${arcId}" does not belong to this story.`);
    }
  }

  /** Compiles the manuscript from the already-fetched export. Oversized output is the caller's fault. */
  private async compileManuscript(
    storyExport: FullStoryExportType,
    options: ManuscriptOptions,
  ): Promise<{ bytes: Uint8Array; format: ManuscriptFormat }> {
    try {
      const compiled = await compileStoryManuscript(
        compileInputOf(storyExport),
        // The book's author defaults to the story's, as on the device.
        {
          ...options,
          author: options.author === undefined ? storyExport.story.author : options.author,
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
  private compileReader(
    storyExport: FullStoryExportType,
    options: ReaderOptionsInput,
  ): { bytes: Uint8Array } {
    try {
      return compileStoryReader(compileInputOf(storyExport), {
        ...options,
        author: options.author === undefined ? storyExport.story.author : options.author,
      });
    } catch (error) {
      if (error instanceof Error && /exceeds the .* limit/.test(error.message)) {
        throw new AppError(400, error.message);
      }
      throw error;
    }
  }

  /** Removes a version's blobs: the .zip and, when they were published, the manuscript and reader siblings. */
  private async deleteVersionBlobs(
    storyId: string,
    publicationId: string,
    published: { manuscriptFormat: string | null; readerByteSize: number | null },
  ): Promise<void> {
    await publicationStorageService.delete(storyId, publicationId).catch(() => undefined);
    if (published.manuscriptFormat) {
      const extension =
        (FORMAT_META as Record<string, { extension: string }>)[published.manuscriptFormat]
          ?.extension ?? published.manuscriptFormat;
      await publicationStorageService
        .deleteManuscript(storyId, publicationId, extension)
        .catch(() => undefined);
    }
    if (published.readerByteSize != null) {
      await publicationStorageService.deleteReader(storyId, publicationId).catch(() => undefined);
    }
  }

  async publish(
    userId: string,
    storyId: string,
    clientOperationVersion: number,
    labelMode: PublicationLabelMode,
    visibility: ShowcaseVisibility = 'public',
    password?: string,
    manuscript?: ManuscriptOptionsInput,
    reader?: ReaderOptionsInput,
    includePackage = true,
  ) {
    await this.assertShowcaseEnabled();
    const story = await this.assertOwnership(userId, storyId);

    // The client also blocks the button, but the server decides: publishing a story with a pending local
    // change would produce a package matching what exists nowhere - not on the device, not here.
    if (clientOperationVersion !== story.lastOperationVersion) {
      throw new AppError(
        409,
        `This story is not in sync with the server (server is at ${story.lastOperationVersion}, you are at ${clientOperationVersion}). Sync it first, then publish.`,
      );
    }

    if (visibility === 'password' && !password) {
      throw new AppError(400, 'A password is required for password-protected stories.');
    }

    // A version with nothing to offer is no version: the package may be left out only when a
    // manuscript or the online reader is there instead.
    if (!includePackage && manuscript === undefined && reader === undefined) {
      throw new AppError(
        400,
        'Select at least one of the story package, the manuscript and the online reader.',
      );
    }

    // Before any packaging or compiling: a refused publication costs nothing. 429, not 403 - the
    // client already reads 403 as "the showcase is off".
    try {
      await tierEnforcementService.assertCanPublish(userId);
    } catch (error) {
      if (error instanceof TierLimitExceededError) {
        throw new AppError(429, error.message);
      }
      throw error;
    }

    let storyExport: FullStoryExportType | null = await this.exportImportService.exportStory(
      storyId,
      userId,
    );
    const publicationId = ulid();
    // Left out when the publisher asked for a manuscript and/or the reader only: no packaging cost.
    let zip = includePackage
      ? await buildStoryZipBytes(storyExport, (item) => blobFromMediaStorage(item.hash))
      : null;

    // Validated and compiled before any blob is written, so a refused manuscript leaves no litter -
    // the same guarantee the .zip gets from the rollback below. `includeLooseScenes` needs no
    // branching branch here: the route compiler ignores it by construction.
    const manuscriptOptions =
      manuscript === undefined ? null : this.parseManuscriptOptions(storyExport, manuscript);
    let compiledManuscript = manuscriptOptions
      ? await compileGate(() => this.compileManuscript(storyExport!, manuscriptOptions))
      : null;
    const readerOptions =
      reader === undefined ? null : this.parseReaderOptions(storyExport, reader);
    let compiledReader = readerOptions
      ? await compileGate(() => this.compileReader(storyExport!, readerOptions))
      : null;
    // Explicit release between stages: the export fed every compile above and nothing below reads
    // it, so drop it now instead of carrying a whole book beside its compiled outputs.
    storyExport = null;

    // Bytes before the row: a row with no blob is a broken download exposed on the site, while a blob with
    // no row is invisible. If the transaction below fails, the files are removed in the `catch` - without
    // that, every refused publication would leave an orphaned .zip taking up disk.
    if (zip) await publicationStorageService.store(storyId, publicationId, zip.bytes);
    if (compiledManuscript) {
      await publicationStorageService.storeManuscript(
        storyId,
        publicationId,
        compiledManuscript.bytes,
        compiledManuscript.format,
      );
    }
    if (compiledReader) {
      await publicationStorageService.storeReader(storyId, publicationId, compiledReader.bytes);
    }
    // The row below only needs scalars: release every staged byte blob now so a
    // package + manuscript + reader never sit side by side any longer than storage needs.
    const packageByteSize = zip ? zip.bytes.byteLength : 0;
    const packageMediaIncluded = zip ? zip.includedCount : 0;
    const packageMediaTotal = zip ? zip.totalCount : 0;
    const packageIncluded = zip !== null;
    const manuscriptFormat = compiledManuscript?.format ?? null;
    const manuscriptByteSize = compiledManuscript ? compiledManuscript.bytes.byteLength : null;
    const readerByteSize = compiledReader ? compiledReader.bytes.byteLength : null;
    zip = null;
    compiledManuscript = null;
    compiledReader = null;

    const passwordHash = visibility === 'password' ? await hashPassword(password!) : null;

    const pruned = await this.runPublishTransaction(
      async (tx) => {
        const existing = await tx
          .select({ label: storyPublications.label })
          .from(storyPublications)
          .where(eq(storyPublications.storyId, storyId));

        // Visibility is written on every publication, not only when it changes: it is part of what the person
        // chose for *this* publication. Without rewriting it, publishing with the padlock off would silently
        // leave a story that was already protected as it was - the action would seem to have no effect at all.
        await tx
          .insert(storyShowcaseEntries)
          .values({ storyId, ownerUserId: userId, labelMode, visibility, passwordHash })
          .onConflictDoUpdate({
            target: storyShowcaseEntries.storyId,
            set: { labelMode, visibility, passwordHash, updatedAt: new Date() },
          });

        await tierEnforcementService.recordPublication(tx, userId, storyId);

        await tx.insert(storyPublications).values({
          id: publicationId,
          storyId,
          ownerUserId: userId,
          label: buildPublicationLabel(
            labelMode,
            story.lastOperationVersion,
            new Date(),
            existing.map((row) => row.label),
          ),
          operationVersion: story.lastOperationVersion,
          formatVersion: CURRENT_STORY_FORMAT_VERSION,
          byteSize: packageByteSize,
          mediaIncluded: packageMediaIncluded,
          mediaTotal: packageMediaTotal,
          packageIncluded,
          manuscriptFormat,
          manuscriptByteSize,
          readerByteSize,
          snapshot: this.snapshotOf(story),
        });

        // The trimming is done here rather than in SQL because `OFFSET` without `LIMIT` is invalid on SQLite,
        // and there are at most six rows per story - not worth an artificial `LIMIT` just for that.
        const existingIds = await tx
          .select({
            id: storyPublications.id,
            manuscriptFormat: storyPublications.manuscriptFormat,
            readerByteSize: storyPublications.readerByteSize,
          })
          .from(storyPublications)
          .where(eq(storyPublications.storyId, storyId))
          .orderBy(desc(storyPublications.createdAt), desc(storyPublications.id));
        const surplus = existingIds.slice(MAX_PUBLICATIONS_PER_STORY);

        if (surplus.length > 0) {
          const ids = surplus.map((row) => row.id);
          await tx.delete(storyPublications).where(inArray(storyPublications.id, ids));
          return surplus;
        }
        return [];
      },
      // Rollback reads the captured scalars, not the released blobs above: by the time this runs,
      // `zip`/`compiledManuscript`/`compiledReader` are already null, but storage still holds the bytes.
      async () => {
        if (packageIncluded) await publicationStorageService.delete(storyId, publicationId);
        if (manuscriptFormat) {
          const extension = FORMAT_META[manuscriptFormat].extension;
          await publicationStorageService.deleteManuscript(storyId, publicationId, extension);
        }
        if (readerByteSize !== null) {
          await publicationStorageService.deleteReader(storyId, publicationId);
        }
      },
    );

    // After the commit: if a blob delete fails, the worst case is an orphaned file, not a version listed
    // on the site whose download no longer exists.
    for (const row of pruned) {
      await this.deleteVersionBlobs(storyId, row.id, row);
    }

    await this.notifyAudience(storyId, userId);
    return this.getPublication(storyId, publicationId);
  }

  async getPublication(storyId: string, publicationId: string) {
    return db.query.storyPublications.findFirst({
      where: and(eq(storyPublications.id, publicationId), eq(storyPublications.storyId, storyId)),
    });
  }

  async listForStory(userId: string, storyId: string) {
    await this.assertOwnership(userId, storyId);
    const entry = await db.query.storyShowcaseEntries.findFirst({
      where: eq(storyShowcaseEntries.storyId, storyId),
    });
    const publications = await db
      .select()
      .from(storyPublications)
      .where(eq(storyPublications.storyId, storyId))
      .orderBy(desc(storyPublications.createdAt));

    return {
      visibility: (entry?.visibility ?? 'public') as ShowcaseVisibility,
      labelMode: (entry?.labelMode ?? 'both') as PublicationLabelMode,
      // Only whether a password exists, never which one - the app needs that to say "password protected" and
      // to offer changing it, and nothing beyond that.
      hasPassword: !!entry?.passwordHash,
      isPublished: !!entry,
      publications,
    };
  }

  /**
   * Every publication of the stories the person can read - their own and the ones shared with them. It
   * is what the app uses to find out, on reconnection, what was published while it was away: the event
   * bus is in memory and resends nothing.
   */
  async listVisibleTo(userId: string) {
    const owned = await db
      .select({ storyId: stories.id })
      .from(stories)
      .where(and(eq(stories.userId, userId), eq(stories.isDeleted, false)));
    const shared = await db
      .select({ storyId: storyPermissions.storyId })
      .from(storyPermissions)
      .where(and(eq(storyPermissions.userId, userId), eq(storyPermissions.isDeleted, false)));

    const storyIds = [...new Set([...owned, ...shared].map((row) => row.storyId))];
    if (storyIds.length === 0) {
      return [];
    }

    return db
      .select()
      .from(storyPublications)
      .where(inArray(storyPublications.storyId, storyIds))
      .orderBy(desc(storyPublications.createdAt));
  }

  async setVisibility(
    userId: string,
    storyId: string,
    visibility: ShowcaseVisibility,
    password?: string,
  ) {
    await this.assertShowcaseEnabled();
    await this.assertOwnership(userId, storyId);

    const entry = await db.query.storyShowcaseEntries.findFirst({
      where: eq(storyShowcaseEntries.storyId, storyId),
    });
    if (!entry) {
      throw new AppError(404, 'This story is not published.');
    }
    if (visibility === 'password' && !password) {
      throw new AppError(400, 'A password is required for password-protected stories.');
    }

    const [updated] = await db
      .update(storyShowcaseEntries)
      .set({
        visibility,
        passwordHash: visibility === 'password' ? await hashPassword(password!) : null,
        updatedAt: new Date(),
      })
      .where(eq(storyShowcaseEntries.storyId, storyId))
      .returning();

    // The hash does not come back even for the owner: it has no use outside, and what does not leave here
    // cannot end up in a log or an open network tab.
    return {
      storyId: updated.storyId,
      ownerUserId: updated.ownerUserId,
      visibility: updated.visibility,
      labelMode: updated.labelMode,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
      hasPassword: visibility === 'password',
    };
  }

  async deletePublication(userId: string, storyId: string, publicationId: string): Promise<void> {
    await this.assertOwnership(userId, storyId);
    const publication = await this.getPublication(storyId, publicationId);
    if (!publication) {
      throw new AppError(404, 'Publication not found.');
    }

    await db.transaction(async (tx) => {
      await tx.delete(storyPublications).where(eq(storyPublications.id, publicationId));
      const left = await tx
        .select({ id: storyPublications.id })
        .from(storyPublications)
        .where(eq(storyPublications.storyId, storyId));
      // With no version left there is nothing to show: the story leaves the showcase along with it.
      if (left.length === 0) {
        await tx.delete(storyShowcaseEntries).where(eq(storyShowcaseEntries.storyId, storyId));
      } else {
        await tx
          .update(storyShowcaseEntries)
          .set({ updatedAt: new Date() })
          .where(eq(storyShowcaseEntries.storyId, storyId));
      }
    });

    await this.deleteVersionBlobs(storyId, publicationId, publication);
    await this.notifyAudience(storyId, userId);
  }

  async unpublish(userId: string, storyId: string): Promise<void> {
    await this.assertOwnership(userId, storyId);

    const removed = await db.transaction(async (tx) => {
      const publications = await tx
        .select({
          id: storyPublications.id,
          manuscriptFormat: storyPublications.manuscriptFormat,
          readerByteSize: storyPublications.readerByteSize,
        })
        .from(storyPublications)
        .where(eq(storyPublications.storyId, storyId));
      await tx.delete(storyPublications).where(eq(storyPublications.storyId, storyId));
      await tx.delete(storyShowcaseEntries).where(eq(storyShowcaseEntries.storyId, storyId));
      return publications;
    });

    for (const row of removed) {
      await this.deleteVersionBlobs(storyId, row.id, row);
    }
    await this.notifyAudience(storyId, userId);
  }
}

export const storyPublicationService = new StoryPublicationService();
