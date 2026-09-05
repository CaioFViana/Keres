import type {
  CommentInsert,
  ModeInsert,
  StatInsert,
  StatRelationInsert,
  StatStrengthInsert,
  SeeAlsoRelationInsert,
} from '../../../db/schema';
import {
  comments,
  favorites,
  modes,
  seeAlsoRelations,
  statRelations,
  stats,
  statStrengths,
} from '../../../db/schema';
import type { SQLiteStoryPackageImportContext } from './SQLiteStoryPackageImportContext';

/**
 * Writes package collections whose references are only valid after every core story entity exists:
 * see-also links, comments, stats and favourites. It is the final phase of one caller-owned
 * SQLite transaction; it neither starts nor commits that transaction.
 */
export async function importStoryPackageFinalCollections(
  context: SQLiteStoryPackageImportContext,
): Promise<void> {
  const { fullStory, queriedServerId, storyId, tx, userId } = context;

  if (fullStory.seeAlsoRelations) {
    for (const relation of fullStory.seeAlsoRelations) {
      const relationToInsert: SeeAlsoRelationInsert = {
        ...relation,
        storyId,
        createdAt: new Date(relation.createdAt),
        updatedAt: new Date(),
        isDeleted: false,
        deletedAt: null,
      };
      await tx.insert(seeAlsoRelations).values(relationToInsert).onConflictDoNothing().run();
    }
  }

  // A copied local story belongs to its importer; downloaded collaborative comments retain authorship.
  if (fullStory.comments) {
    for (const comment of fullStory.comments) {
      const commentToInsert: CommentInsert = {
        ...comment,
        storyId,
        authorUserId: queriedServerId ? comment.authorUserId : userId,
        createdAt: new Date(comment.createdAt),
        updatedAt: new Date(),
        isDeleted: false,
        deletedAt: null,
      };
      await tx.insert(comments).values(commentToInsert).run();
    }
  }

  // Stat and Mode precede values that reference them.
  if (fullStory.stats) {
    for (const stat of fullStory.stats) {
      const statToInsert: StatInsert = {
        ...stat,
        storyId,
        createdAt: new Date(stat.createdAt),
        updatedAt: new Date(),
        isDeleted: false,
        deletedAt: null,
      };
      await tx.insert(stats).values(statToInsert).run();
    }
  }

  if (fullStory.modes) {
    for (const mode of fullStory.modes) {
      const modeToInsert: ModeInsert = {
        ...mode,
        storyId,
        createdAt: new Date(mode.createdAt),
        updatedAt: new Date(),
        isDeleted: false,
        deletedAt: null,
      };
      await tx.insert(modes).values(modeToInsert).run();
    }
  }

  if (fullStory.statStrengths) {
    for (const strength of fullStory.statStrengths) {
      const strengthToInsert: StatStrengthInsert = {
        ...strength,
        storyId,
        createdAt: new Date(strength.createdAt),
        updatedAt: new Date(),
        isDeleted: false,
        deletedAt: null,
      };
      await tx.insert(statStrengths).values(strengthToInsert).run();
    }
  }

  if (fullStory.statRelations) {
    for (const value of fullStory.statRelations) {
      const valueToInsert: StatRelationInsert = {
        ...value,
        storyId,
        createdAt: new Date(value.createdAt),
        updatedAt: new Date(),
        isDeleted: false,
        deletedAt: null,
      };
      await tx.insert(statRelations).values(valueToInsert).run();
    }
  }

  if (fullStory.favorites) {
    for (const favorite of fullStory.favorites) {
      await tx
        .insert(favorites)
        .values({
          ...favorite,
          storyId,
          userId: queriedServerId ? favorite.userId : userId,
          createdAt: new Date(favorite.createdAt),
          updatedAt: new Date(),
          isDeleted: false,
          deletedAt: null,
        })
        .onConflictDoNothing()
        .run();
    }
  }
}
