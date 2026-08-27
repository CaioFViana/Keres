import type {
  CreateChapterRelationDataType,
  CreateStoryUpdate,
  DeleteStoryUpdate,
  UpdateStoryUpdate,
} from '@keres/shared';
import { CreateChapterRelationDataSchema, PartialChapterRelationSchema } from '@keres/shared';
import { and, eq, ne, or } from 'drizzle-orm';
import { db } from '../../db';
import { chapterRelations, chapters } from '../../db/schema';
import { BaseSyncEntityHandler, SyncConflictError } from './BaseSyncEntityHandler';

/**
 * Chronology relations between containers.
 *
 * **The ids are not sorted**, unlike `CharacterRelationSyncHandler`, and that difference is the
 * whole point: `before` and `during` are directional, so `chapter1Id` and `chapter2Id` are a
 * sequence rather than a pair. Sorting them would silently reverse half the statements a writer
 * makes.
 *
 * Uniqueness is still on the *unordered* pair, enforced here by looking both ways round. One live
 * statement per pair is what makes "A before B" and "B before A" impossible to hold at once, so a
 * direct contradiction cannot be stored at all - only the transitive kind survives, and that is a
 * cycle for the analysis to report.
 */
export class ChapterRelationSyncHandler extends BaseSyncEntityHandler<
  typeof CreateChapterRelationDataSchema,
  typeof PartialChapterRelationSchema
> {
  entityName = 'ChapterRelation';

  constructor() {
    super(
      'chapterRelations',
      'id',
      'version',
      CreateChapterRelationDataSchema,
      PartialChapterRelationSchema,
      {
        storyIdColumnName: 'storyId',
        isDeletedColumnName: 'isDeleted',
        deletedAtColumnName: 'deletedAt',
      },
    );
  }

  private async validateRelatedEntities(
    storyId: string,
    chapter1Id: string,
    chapter2Id: string,
  ): Promise<void> {
    if (chapter1Id === chapter2Id) {
      throw new Error('Validation Error: a container cannot be related to itself.');
    }

    for (const [label, id] of [
      ['Chapter 1', chapter1Id],
      ['Chapter 2', chapter2Id],
    ] as const) {
      const exists = await db.query.chapters.findFirst({
        where: and(
          eq(chapters.id, id),
          eq(chapters.storyId, storyId),
          eq(chapters.isDeleted, false),
        ),
      });
      if (!exists) {
        throw new SyncConflictError(
          'referenced_entity_deleted',
          `Validation Error: ${label} with ID ${id} not found, is deleted, or does not belong to story ${storyId}.`,
        );
      }
    }
  }

  /** A live statement about this pair, in either direction. */
  private async findLivePair(
    storyId: string,
    chapter1Id: string,
    chapter2Id: string,
    excludeId?: string,
  ) {
    const conditions = [
      eq(chapterRelations.storyId, storyId),
      eq(chapterRelations.isDeleted, false),
      or(
        and(
          eq(chapterRelations.chapter1Id, chapter1Id),
          eq(chapterRelations.chapter2Id, chapter2Id),
        ),
        and(
          eq(chapterRelations.chapter1Id, chapter2Id),
          eq(chapterRelations.chapter2Id, chapter1Id),
        ),
      ),
    ];
    if (excludeId) conditions.push(ne(chapterRelations.id, excludeId));
    return db.query.chapterRelations.findFirst({ where: and(...conditions) });
  }

  async create(userId: string, storyId: string, update: CreateStoryUpdate): Promise<void> {
    const validatedData: CreateChapterRelationDataType = this.createSchema.parse(update.data);
    const { chapter1Id, chapter2Id, relationType } = validatedData;

    await this.validateRelatedEntities(storyId, chapter1Id, chapter2Id);

    if (await this.findLivePair(storyId, chapter1Id, chapter2Id)) {
      throw new Error(
        `Conflict: a chronology relation between ${chapter1Id} and ${chapter2Id} already exists. ` +
          'Two containers hold one statement about their order, in one direction or the other.',
      );
    }

    await db.insert(chapterRelations).values({
      id: update.id!,
      storyId,
      chapter1Id,
      chapter2Id,
      relationType,
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
      isDeleted: false,
      deletedAt: null,
    });
  }

  async update(
    userId: string,
    storyId: string,
    update: UpdateStoryUpdate,
    currentEntity: any,
  ): Promise<void> {
    const validatedChanges = this.updateSchema.parse(update.changes);

    if (validatedChanges.chapter1Id || validatedChanges.chapter2Id) {
      const nextChapter1Id = validatedChanges.chapter1Id || currentEntity.chapter1Id;
      const nextChapter2Id = validatedChanges.chapter2Id || currentEntity.chapter2Id;

      await this.validateRelatedEntities(storyId, nextChapter1Id, nextChapter2Id);

      if (await this.findLivePair(storyId, nextChapter1Id, nextChapter2Id, update.id!)) {
        throw new Error(
          `Conflict: a chronology relation between ${nextChapter1Id} and ${nextChapter2Id} already exists.`,
        );
      }
    }

    await super.update(userId, storyId, update, currentEntity);
  }

  async delete(
    userId: string,
    storyId: string,
    update: DeleteStoryUpdate,
    currentEntity: any,
  ): Promise<void> {
    await super.delete(userId, storyId, update, currentEntity);
  }
}
