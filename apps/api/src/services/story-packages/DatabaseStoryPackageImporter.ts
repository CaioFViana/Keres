import {
  describeStoryIntegrityViolations,
  findStoryExportIntegrityErrors,
  FullStoryExportSchema,
  migrateStoryExport,
  StoryExportVersionError,
} from '@keres/shared';
import { ulid } from 'ulid';
import { db } from '../../db';
import { TierLimitExceededError, tierEnforcementService } from '../TierEnforcementService';
import { AppError } from '../../utils/errors';
import { importStoryAssets } from './DatabaseStoryPackageAssetsImport';
import { importStoryCore } from './DatabaseStoryPackageCoreImport';
import { importStoryFinalCollections } from './DatabaseStoryPackageFinalImport';
import { importStoryInteractions } from './DatabaseStoryPackageInteractionsImport';
import { importNarrativeCollections } from './DatabaseStoryPackageNarrativeImport';

/**
 * Transaction coordinator for portable-story import. It migrates and validates the uploaded
 * package, checks account limits, establishes the ID map, and invokes the ordered domain phases;
 * it deliberately contains neither entity conversion rules nor generic SQL inserts.
 */
export class DatabaseStoryPackageImporter {
  async importStory(userId: string, fullStoryJSON: unknown, newStoryId?: string): Promise<string> {
    let migrated: unknown;
    try {
      migrated = migrateStoryExport(fullStoryJSON);
    } catch (err) {
      if (err instanceof StoryExportVersionError) {
        throw new AppError(422, err.message);
      }
      throw err;
    }
    const validatedFullStory = FullStoryExportSchema.parse(migrated);

    // The schema validates each row on its own; this validates the file as a set. Some of it the
    // database would catch anyway - but only halfway through the transaction, as a constraint
    // violation with a column name in it and nothing the caller can act on. And some of it it would
    // not catch at all: the loops below remap ids without sorting the two ends of a symmetric
    // relation, so (A,B) and (B,A) both get past the unique constraint on the ordered pair.
    const integrityErrors = findStoryExportIntegrityErrors(validatedFullStory);
    if (integrityErrors.length) {
      throw new AppError(
        422,
        `This story package contradicts itself and cannot be imported: ${describeStoryIntegrityViolations(integrityErrors)}`,
      );
    }

    // Fails fast before opening the transaction: importing a whole story and only then refusing it would
    // leave the user with no idea why nothing was saved, and would burn database work on an import that
    // was going to be discarded anyway.
    try {
      await tierEnforcementService.assertCanCreateStory(userId);
    } catch (error) {
      if (error instanceof TierLimitExceededError) {
        throw new AppError(403, error.message);
      }
      throw error;
    }

    // Determine the target story ID. If newStoryId is provided, use it. Otherwise, generate a new one.
    const targetStoryId = newStoryId || ulid();

    await db.transaction(async (tx) => {
      const now = new Date();

      // If newStoryId was provided, check if a story with this ID already exists for the user.
      // Overwriting is not allowed, so if it exists, throw an error.
      if (newStoryId) {
        // Only check if newStoryId was explicitly provided
        const existingStory = await tx.query.stories.findFirst({
          where: (stories, { eq, and }) =>
            and(eq(stories.id, targetStoryId), eq(stories.userId, userId)),
        });

        if (existingStory) {
          throw new Error(
            `Story with ID ${targetStoryId} already exists for this user. Import not allowed as overwriting is disabled.`,
          );
        }
      }

      // Map old IDs to new IDs for all entities to avoid conflicts and link correctly to the new story ID
      const idMap: Map<string, string> = new Map();
      idMap.set(validatedFullStory.story.id, targetStoryId); // Map old story ID to new story ID

      /**
       * `newStoryId` only ever comes from `uploadNewStoryToServer` (see the client's
       * `/stories/import?storyId=` call, and this route's own doc comment) - the client's
       * one-time "link a story I built fully offline to a server" flow. From that moment
       * on the client keeps referencing every entity in that story by its *local* ID
       * forever. Previously only the story row itself preserved its ID here; every child
       * entity below got a fresh server-generated ULID that the client never learned
       * about, so any later operation referencing that entity by its original local ID
       * (e.g. a GalleryRelation pointing at a Character) would permanently fail with
       * "not found" - not a transient race, a structural ID mismatch with no retry that
       * could ever fix it. When `newStoryId` is absent (download/duplicate from another
       * server), fresh IDs are still generated as before - that path has no client
       * expecting IDs to match.
       */
      const preserveIds = !!newStoryId;
      const nextId = (originalId: string): string => (preserveIds ? originalId : ulid());

      const context = {
        tx,
        fullStory: validatedFullStory,
        userId,
        targetStoryId,
        now,
        idMap,
        nextId,
      };
      await importStoryCore(context);
      await importNarrativeCollections(context);
      await importStoryAssets(context);
      await importStoryInteractions(context);
      await importStoryFinalCollections(context);
    });

    return targetStoryId;
  }
}
