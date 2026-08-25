import type {
  CreateStatRelationDataType,
  CreateStoryUpdate,
  UpdateStoryUpdate,
} from '@keres/shared';
import { CreateStatRelationDataSchema, PartialStatRelationSchema } from '@keres/shared';
import { and, eq, isNull, ne } from 'drizzle-orm';
import { db } from '../../db';
import { characters, modes, statRelations, stats } from '../../db/schema';
import { BaseSyncEntityHandler, SyncConflictError } from './BaseSyncEntityHandler';

export class StatRelationSyncHandler extends BaseSyncEntityHandler<
  typeof CreateStatRelationDataSchema,
  typeof PartialStatRelationSchema
> {
  entityName = 'StatRelation';

  constructor() {
    super(
      'statRelations',
      'id',
      'version',
      CreateStatRelationDataSchema,
      PartialStatRelationSchema,
      {
        storyIdColumnName: 'storyId',
        isDeletedColumnName: 'isDeleted',
        deletedAtColumnName: 'deletedAt',
      },
    );
  }

  private async validateReferences(
    storyId: string,
    characterId: string,
    modeId: string | null,
    statId: string,
  ): Promise<void> {
    const character = await db.query.characters.findFirst({
      where: and(
        eq(characters.id, characterId),
        eq(characters.storyId, storyId),
        eq(characters.isDeleted, false),
      ),
    });
    if (!character) {
      throw new SyncConflictError(
        'referenced_entity_deleted',
        `Validation Error: Character with ID ${characterId} not found, is deleted, or does not belong to story ${storyId}.`,
      );
    }

    const stat = await db.query.stats.findFirst({
      where: and(eq(stats.id, statId), eq(stats.storyId, storyId), eq(stats.isDeleted, false)),
    });
    if (!stat) {
      throw new SyncConflictError(
        'referenced_entity_deleted',
        `Validation Error: Stat with ID ${statId} not found, is deleted, or does not belong to story ${storyId}.`,
      );
    }

    if (modeId) {
      const mode = await db.query.modes.findFirst({
        where: and(eq(modes.id, modeId), eq(modes.storyId, storyId), eq(modes.isDeleted, false)),
      });
      if (!mode) {
        throw new SyncConflictError(
          'referenced_entity_deleted',
          `Validation Error: Mode with ID ${modeId} not found, is deleted, or does not belong to story ${storyId}.`,
        );
      }
      // Um modo pertence a um personagem; um valor não pode cruzar os dois.
      if (mode.characterId !== characterId) {
        throw new SyncConflictError(
          'validation',
          `Validation Error: Mode ${modeId} does not belong to character ${characterId}.`,
        );
      }
    }
  }

  /** Dois valores para o mesmo (personagem, modo, stat) fariam a leitura depender da ordem. */
  private async assertNoDuplicateValue(
    storyId: string,
    characterId: string,
    modeId: string | null,
    statId: string,
    excludeId?: string,
  ): Promise<void> {
    const duplicate = await db.query.statRelations.findFirst({
      where: and(
        eq(statRelations.storyId, storyId),
        eq(statRelations.characterId, characterId),
        modeId === null ? isNull(statRelations.modeId) : eq(statRelations.modeId, modeId),
        eq(statRelations.statId, statId),
        eq(statRelations.isDeleted, false),
        ...(excludeId ? [ne(statRelations.id, excludeId)] : []),
      ),
    });

    if (duplicate) {
      throw new SyncConflictError(
        'validation',
        `Validation Error: character ${characterId} already has a value for stat ${statId} in this mode.`,
      );
    }
  }

  async create(userId: string, storyId: string, update: CreateStoryUpdate): Promise<void> {
    const validatedData: CreateStatRelationDataType = this.createSchema.parse(update.data);

    const existing = await this.findById(update.id!);
    if (existing) {
      throw new Error(`Conflict: StatRelation with ID ${update.id} already exists.`);
    }

    await this.validateReferences(
      storyId,
      validatedData.characterId,
      validatedData.modeId,
      validatedData.statId,
    );
    await this.assertNoDuplicateValue(
      storyId,
      validatedData.characterId,
      validatedData.modeId,
      validatedData.statId,
    );

    await db.insert(statRelations).values({
      id: update.id!,
      storyId,
      characterId: validatedData.characterId,
      modeId: validatedData.modeId,
      statId: validatedData.statId,
      value: validatedData.value,
      createdAt: new Date(),
      updatedAt: new Date(),
      version: 1,
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
    const touchesKey =
      validatedChanges.characterId !== undefined ||
      validatedChanges.modeId !== undefined ||
      validatedChanges.statId !== undefined;

    if (touchesKey) {
      const characterId = validatedChanges.characterId ?? currentEntity.characterId;
      const modeId =
        validatedChanges.modeId !== undefined ? validatedChanges.modeId : currentEntity.modeId;
      const statId = validatedChanges.statId ?? currentEntity.statId;

      await this.validateReferences(storyId, characterId, modeId, statId);
      await this.assertNoDuplicateValue(storyId, characterId, modeId, statId, update.id!);
    }

    await super.update(userId, storyId, update, currentEntity);
  }
}
