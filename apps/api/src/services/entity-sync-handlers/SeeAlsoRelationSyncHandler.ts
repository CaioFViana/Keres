import {
  CreateSeeAlsoRelationDataSchema,
  CreateSeeAlsoRelationDataType,
  CreateStoryUpdate,
  DeleteStoryUpdate,
  PartialSeeAlsoRelationSchema,
  SeeAlsoEntityType,
  UpdateStoryUpdate,
} from '@keres/shared';
import { and, eq, or } from 'drizzle-orm';
import { db } from '../../db';
import {
  chapters,
  characters,
  choices,
  items,
  itemJourneys,
  locations,
  scenes,
  seeAlsoRelations,
  worldRules,
} from '../../db/schema';
import { BaseSyncEntityHandler } from './BaseSyncEntityHandler';

type EntityRef = { type: SeeAlsoEntityType; id: string };

/** Ordenação canônica (A/B) usada tanto na criação quanto na checagem de duplicidade, para
 *  que o mesmo par não-ordenado nunca seja armazenado duas vezes em ordens diferentes. */
function sortEntityRefs(a: EntityRef, b: EntityRef): [EntityRef, EntityRef] {
  return `${a.type}:${a.id}` <= `${b.type}:${b.id}` ? [a, b] : [b, a];
}

export class SeeAlsoRelationSyncHandler extends BaseSyncEntityHandler<
  typeof CreateSeeAlsoRelationDataSchema,
  typeof PartialSeeAlsoRelationSchema
> {
  entityName = 'SeeAlsoRelation';

  constructor() {
    super(
      'seeAlsoRelations',
      'id',
      'version',
      CreateSeeAlsoRelationDataSchema,
      PartialSeeAlsoRelationSchema,
      {
        storyIdColumnName: 'storyId',
        isDeletedColumnName: 'isDeleted',
        deletedAtColumnName: 'deletedAt',
      },
    );
  }

  private async validateRelatedEntity(storyId: string, ref: EntityRef): Promise<void> {
    let exists: unknown;
    switch (ref.type) {
      case 'Character':
        exists = await db.query.characters.findFirst({
          where: and(
            eq(characters.id, ref.id),
            eq(characters.storyId, storyId),
            eq(characters.isDeleted, false),
          ),
        });
        break;
      case 'Location':
        exists = await db.query.locations.findFirst({
          where: and(
            eq(locations.id, ref.id),
            eq(locations.storyId, storyId),
            eq(locations.isDeleted, false),
          ),
        });
        break;
      case 'Chapter':
        exists = await db.query.chapters.findFirst({
          where: and(
            eq(chapters.id, ref.id),
            eq(chapters.storyId, storyId),
            eq(chapters.isDeleted, false),
          ),
        });
        break;
      case 'Scene':
        exists = await db.query.scenes.findFirst({
          where: and(
            eq(scenes.id, ref.id),
            eq(scenes.storyId, storyId),
            eq(scenes.isDeleted, false),
          ),
        });
        break;
      case 'Item':
        exists = await db.query.items.findFirst({
          where: and(eq(items.id, ref.id), eq(items.storyId, storyId), eq(items.isDeleted, false)),
        });
        break;
      case 'ItemJourney':
        exists = await db.query.itemJourneys.findFirst({
          where: and(
            eq(itemJourneys.id, ref.id),
            eq(itemJourneys.storyId, storyId),
            eq(itemJourneys.isDeleted, false),
          ),
        });
        break;
      case 'WorldRule':
        exists = await db.query.worldRules.findFirst({
          where: and(
            eq(worldRules.id, ref.id),
            eq(worldRules.storyId, storyId),
            eq(worldRules.isDeleted, false),
          ),
        });
        break;
      case 'Choice':
        exists = await db.query.choices.findFirst({
          where: and(
            eq(choices.id, ref.id),
            eq(choices.storyId, storyId),
            eq(choices.isDeleted, false),
          ),
        });
        break;
      default:
        throw new Error(`Validation Error: Unsupported SeeAlsoEntityType: ${ref.type}.`);
    }
    if (!exists) {
      throw new Error(
        `Validation Error: ${ref.type} with ID ${ref.id} not found, is deleted, or does not belong to story ${storyId}.`,
      );
    }
  }

  private async findExistingPair(storyId: string, a: EntityRef, b: EntityRef, excludeId?: string) {
    const existing = await db.query.seeAlsoRelations.findFirst({
      where: and(
        eq(seeAlsoRelations.storyId, storyId),
        eq(seeAlsoRelations.isDeleted, false),
        or(
          and(
            eq(seeAlsoRelations.entityAType, a.type),
            eq(seeAlsoRelations.entityAId, a.id),
            eq(seeAlsoRelations.entityBType, b.type),
            eq(seeAlsoRelations.entityBId, b.id),
          ),
          and(
            eq(seeAlsoRelations.entityAType, b.type),
            eq(seeAlsoRelations.entityAId, b.id),
            eq(seeAlsoRelations.entityBType, a.type),
            eq(seeAlsoRelations.entityBId, a.id),
          ),
        ),
      ),
    });
    if (existing && existing.id !== excludeId) {
      return existing;
    }
    return undefined;
  }

  async create(userId: string, storyId: string, update: CreateStoryUpdate): Promise<void> {
    const validatedData: CreateSeeAlsoRelationDataType = this.createSchema.parse(update.data);

    const refA: EntityRef = { type: validatedData.entityAType, id: validatedData.entityAId };
    const refB: EntityRef = { type: validatedData.entityBType, id: validatedData.entityBId };

    if (refA.type === refB.type && refA.id === refB.id) {
      throw new Error('Validation Error: an entity cannot be See-Also-linked to itself.');
    }

    const [entityA, entityB] = sortEntityRefs(refA, refB);
    await this.validateRelatedEntity(storyId, entityA);
    await this.validateRelatedEntity(storyId, entityB);

    const existing = await this.findExistingPair(storyId, entityA, entityB);
    if (existing) {
      throw new Error(
        `Conflict: SeeAlsoRelation between ${entityA.type}:${entityA.id} and ${entityB.type}:${entityB.id} already exists and is not deleted.`,
      );
    }

    await db.insert(seeAlsoRelations).values({
      id: update.id!,
      storyId,
      entityAType: entityA.type,
      entityAId: entityA.id,
      entityBType: entityB.type,
      entityBId: entityB.id,
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

    // Um vínculo "Veja também" ou existe ou não existe - não há edição parcial que faça
    // sentido além de restaurar a partir de um tombstone (tratado pela classe base).
    if (
      validatedChanges.entityAType ||
      validatedChanges.entityAId ||
      validatedChanges.entityBType ||
      validatedChanges.entityBId
    ) {
      throw new Error(
        'Validation Error: Cannot change the linked entities of an existing SeeAlsoRelation.',
      );
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
