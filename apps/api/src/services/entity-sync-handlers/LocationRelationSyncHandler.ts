import type {
  CreateLocationRelationDataType,
  CreateStoryUpdate,
  DeleteStoryUpdate,
  UpdateStoryUpdate,
} from '@keres/shared';
import { CreateLocationRelationDataSchema, PartialLocationRelationSchema } from '@keres/shared';
import { and, eq } from 'drizzle-orm';
import { db } from '../../db';
import { locationRelations, locations } from '../../db/schema';
import { BaseSyncEntityHandler, SyncConflictError } from './BaseSyncEntityHandler';

/**
 * A defensive limit against an infinite loop if the data somehow becomes corrupted - in a valid
 * hierarchy (single-parent, no cycles) the ancestor chain never comes close to it.
 */
const MAX_ANCESTOR_WALK = 500;

export class LocationRelationSyncHandler extends BaseSyncEntityHandler<
  typeof CreateLocationRelationDataSchema,
  typeof PartialLocationRelationSchema
> {
  entityName = 'LocationRelation';

  constructor() {
    super(
      'locationRelations',
      'id',
      'version',
      CreateLocationRelationDataSchema,
      PartialLocationRelationSchema,
      {
        storyIdColumnName: 'storyId',
        isDeletedColumnName: 'isDeleted',
        deletedAtColumnName: 'deletedAt',
      },
    );
  }

  private sortLocationIds(id1: string, id2: string): [string, string] {
    return id1 < id2 ? [id1, id2] : [id2, id1];
  }

  private async validateRelatedEntities(
    storyId: string,
    locationAId: string,
    locationBId: string,
  ): Promise<void> {
    if (locationAId === locationBId) {
      throw new Error('Validation Error: locationAId and locationBId cannot be identical.');
    }

    const locationAExists = await db.query.locations.findFirst({
      where: and(
        eq(locations.id, locationAId),
        eq(locations.storyId, storyId),
        eq(locations.isDeleted, false),
      ),
    });
    if (!locationAExists) {
      throw new SyncConflictError(
        'referenced_entity_deleted',
        `Validation Error: Location A with ID ${locationAId} not found, is deleted, or does not belong to story ${storyId}.`,
      );
    }

    const locationBExists = await db.query.locations.findFirst({
      where: and(
        eq(locations.id, locationBId),
        eq(locations.storyId, storyId),
        eq(locations.isDeleted, false),
      ),
    });
    if (!locationBExists) {
      throw new SyncConflictError(
        'referenced_entity_deleted',
        `Validation Error: Location B with ID ${locationBId} not found, is deleted, or does not belong to story ${storyId}.`,
      );
    }
  }

  /**
   * It only applies to 'contains': each Location has at most one live parent, so the ancestor chain is a
   * simple list (no general graph search needed). It rejects if `childId` appears among `newParentId`'s
   * ancestors - that would close a cycle.
   */
  private async validateNoCycle(
    storyId: string,
    childId: string,
    newParentId: string,
  ): Promise<void> {
    let currentId: string | null = newParentId;
    let steps = 0;

    while (currentId) {
      if (currentId === childId) {
        throw new Error(
          `Validation Error: setting this parent would create a cycle in the Location hierarchy.`,
        );
      }

      if (++steps > MAX_ANCESTOR_WALK) {
        throw new Error(
          'Validation Error: Location hierarchy ancestor chain exceeded the maximum allowed depth.',
        );
      }

      const parentEdge: { locationAId: string } | undefined =
        await db.query.locationRelations.findFirst({
          where: and(
            eq(locationRelations.storyId, storyId),
            eq(locationRelations.locationBId, currentId),
            eq(locationRelations.relationType, 'contains'),
            eq(locationRelations.isDeleted, false),
          ),
        });

      currentId = parentEdge?.locationAId ?? null;
    }
  }

  /** For 'contains': the child (locationBId) can only have one live parent at a time. */
  private async findExistingParentEdge(storyId: string, childId: string, excludeId?: string) {
    const existing = await db.query.locationRelations.findFirst({
      where: and(
        eq(locationRelations.storyId, storyId),
        eq(locationRelations.locationBId, childId),
        eq(locationRelations.relationType, 'contains'),
        eq(locationRelations.isDeleted, false),
      ),
    });
    if (existing && existing.id !== excludeId) {
      return existing;
    }
    return undefined;
  }

  private async findExistingConnection(
    storyId: string,
    sortedAId: string,
    sortedBId: string,
    excludeId?: string,
  ) {
    const existing = await db.query.locationRelations.findFirst({
      where: and(
        eq(locationRelations.storyId, storyId),
        eq(locationRelations.locationAId, sortedAId),
        eq(locationRelations.locationBId, sortedBId),
        eq(locationRelations.relationType, 'connected_to'),
        eq(locationRelations.isDeleted, false),
      ),
    });
    if (existing && existing.id !== excludeId) {
      return existing;
    }
    return undefined;
  }

  async create(userId: string, storyId: string, update: CreateStoryUpdate): Promise<void> {
    const validatedData: CreateLocationRelationDataType = this.createSchema.parse(update.data);

    let locationAId = validatedData.locationAId;
    let locationBId = validatedData.locationBId;

    if (validatedData.relationType === 'connected_to') {
      [locationAId, locationBId] = this.sortLocationIds(locationAId, locationBId);
      await this.validateRelatedEntities(storyId, locationAId, locationBId);

      const existingConnection = await this.findExistingConnection(
        storyId,
        locationAId,
        locationBId,
      );
      if (existingConnection) {
        throw new Error(
          `Conflict: LocationRelation (connected_to) between ${locationAId} and ${locationBId} already exists and is not deleted.`,
        );
      }
    } else {
      // 'contains': locationAId is the parent, locationBId is the child - order matters, do not sort.
      await this.validateRelatedEntities(storyId, locationAId, locationBId);

      const existingParentEdge = await this.findExistingParentEdge(storyId, locationBId);
      if (existingParentEdge) {
        throw new Error(`Conflict: Location ${locationBId} already has a parent Location.`);
      }

      await this.validateNoCycle(storyId, locationBId, locationAId);
    }

    await db.insert(locationRelations).values({
      id: update.id!,
      storyId,
      locationAId,
      locationBId,
      relationType: validatedData.relationType,
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

    let newLocationAId: string = validatedChanges.locationAId || currentEntity.locationAId;
    let newLocationBId: string = validatedChanges.locationBId || currentEntity.locationBId;
    const newRelationType: string = validatedChanges.relationType || currentEntity.relationType;

    const idsChanged = !!(
      validatedChanges.locationAId ||
      validatedChanges.locationBId ||
      validatedChanges.relationType
    );

    if (idsChanged) {
      if (newRelationType === 'connected_to') {
        [newLocationAId, newLocationBId] = this.sortLocationIds(newLocationAId, newLocationBId);
        await this.validateRelatedEntities(storyId, newLocationAId, newLocationBId);

        const existingConnection = await this.findExistingConnection(
          storyId,
          newLocationAId,
          newLocationBId,
          update.id,
        );
        if (existingConnection) {
          throw new Error(
            `Conflict: LocationRelation (connected_to) between ${newLocationAId} and ${newLocationBId} already exists and is not deleted.`,
          );
        }
      } else {
        await this.validateRelatedEntities(storyId, newLocationAId, newLocationBId);

        const existingParentEdge = await this.findExistingParentEdge(
          storyId,
          newLocationBId,
          update.id,
        );
        if (existingParentEdge) {
          throw new Error(`Conflict: Location ${newLocationBId} already has a parent Location.`);
        }

        await this.validateNoCycle(storyId, newLocationBId, newLocationAId);
      }

      validatedChanges.locationAId = newLocationAId;
      validatedChanges.locationBId = newLocationBId;
      validatedChanges.relationType =
        newRelationType as CreateLocationRelationDataType['relationType'];
    }

    await super.update(
      userId,
      storyId,
      { ...update, changes: { ...validatedChanges, version: update.changes.version } },
      currentEntity,
    );
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
