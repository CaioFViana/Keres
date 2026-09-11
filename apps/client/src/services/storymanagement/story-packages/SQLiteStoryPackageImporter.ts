import type { EffectiveStoryRole, FullStoryExportType } from '@keres/shared';
import { assertStoryExportIntegrity } from '@keres/shared';
import type { AppDrizzleClient } from '../../../db';
import { cloneStoryForLocalImport } from '../cloneStoryForLocalImport';
import { deleteStoryChildRows } from '../storyLocalPurge';
import { importStoryPackageAssets } from './SQLiteStoryPackageAssetsImport';
import { importStoryPackageCore } from './SQLiteStoryPackageCoreImport';
import { importStoryPackageFinalCollections } from './SQLiteStoryPackageFinalImport';
import { importStoryPackageRelations } from './SQLiteStoryPackageRelationsImport';

/**
 * Coordinates an ordered SQLite story-package import. It prepares local copies, validates the
 * whole package and runs every persistence phase in one transaction; StoryService only exposes
 * this adapter as part of its public story lifecycle API.
 */
export async function importSQLiteStoryPackage(
  db: AppDrizzleClient,
  userId: string,
  fullStoryData: FullStoryExportType,
  queriedServerId: string | null,
  role: EffectiveStoryRole | null = null,
  localMediaPaths?: Map<string, string>,
  localImportStoryId?: string,
): Promise<string> {
  // A file import is a new local copy. A server download keeps remote IDs because those IDs are
  // the synchronization identity for that shared story.
  const importedStory = queriedServerId
    ? fullStoryData
    : cloneStoryForLocalImport(fullStoryData, userId, localImportStoryId);

  // Row schemas cannot validate relations between rows. Validate after cloning because those are
  // the IDs that will reach SQLite, which otherwise accepts more than the server does.
  assertStoryExportIntegrity(importedStory);

  return db.transaction(async (tx) => {
    // A retry can follow a partial import, leaving child rows despite no story row. Clearing those
    // rows avoids collisions and makes a fresh package import self-healing.
    await deleteStoryChildRows(tx, importedStory.story.id);
    const storyId = importedStory.story.id;
    const context = {
      tx,
      fullStory: importedStory,
      storyId,
      userId,
      queriedServerId,
      role,
      localMediaPaths,
    };

    await importStoryPackageCore(context);
    await importStoryPackageRelations(context);
    await importStoryPackageAssets(context);
    await importStoryPackageFinalCollections(context);

    return storyId;
  });
}
