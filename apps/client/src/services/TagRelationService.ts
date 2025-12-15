import { TagRelationEntities } from '@keres/shared';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { AppDrizzleClient, TagRelationInsert, tagRelations, tags, TagSelect } from '../db';
import { prepareNewEntityData } from '../utils/entityUtils';
import { entityEventEmitter } from '../utils/EventEmitter';
import { getUserIdForOperation, recordLocalOperation } from '../utils/syncUtils';
import { createServerService } from './ServerService';

export interface TagRelationService {
  getTagsForEntity(storyId: string, entityId: string, entityType: TagRelationEntities): Promise<TagSelect[]>;
  addTagToEntity(currentUserId: string, storyId: string, entityId: string, entityType: TagRelationEntities, tagId: string): Promise<void>;
  removeTagFromEntity(currentUserId: string, storyId: string, entityId: string, entityType: TagRelationEntities, tagId: string): Promise<void>;
  updateTagsForEntity(currentUserId: string, storyId: string, entityId: string, entityType: TagRelationEntities, newTagIds: string[]): Promise<void>;
}

export const createTagRelationService = (db: AppDrizzleClient): TagRelationService => {
  const serverService = createServerService(db);
  return {
    async getTagsForEntity(storyId, entityId, entityType): Promise<TagSelect[]> {
      const relations = await db.select({ tagId: tagRelations.tagId })
        .from(tagRelations)
        .where(and(
          eq(tagRelations.storyId, storyId),
          eq(tagRelations.relationId, entityId),
          eq(tagRelations.relationType, entityType),
          eq(tagRelations.isDeleted, false)
        ))
        .execute();

      const tagIds = relations.map(r => r.tagId);

      if (tagIds.length === 0) {
        return [];
      }

      const fetchedTags = await db.select()
        .from(tags)
        .where(and(
          inArray(tags.id, tagIds),
          eq(tags.isDeleted, false)
        ))
        .execute();
      
      return fetchedTags;
    },

    async addTagToEntity(currentUserId, storyId, relationId, relationType, tagId): Promise<void> {
      // Check if the relation already exists and is not deleted
      const existingRelation = await db.query.tagRelations.findFirst({
        where: and(
          eq(tagRelations.storyId, storyId),
          eq(tagRelations.relationId, relationId),
          eq(tagRelations.relationType, relationType),
          eq(tagRelations.tagId, tagId),
          eq(tagRelations.isDeleted, false)
        ),
      });

      if (existingRelation) {
        console.log(`Tag relation already exists and is active for entity ${relationId} with tag ${tagId}.`);
        return;
      }

      // Check if a deleted relation exists to reactivate it
      const deletedRelation = await db.query.tagRelations.findFirst({
        where: and(
          eq(tagRelations.storyId, storyId),
          eq(tagRelations.relationId, relationId),
          eq(tagRelations.relationType, relationType),
          eq(tagRelations.tagId, tagId),
          eq(tagRelations.isDeleted, true)
        ),
      });

      if (deletedRelation) {
        // Reactivate the deleted relation
        const [updatedRelation] = await db.update(tagRelations)
          .set({ isDeleted: false, deletedAt: null, updatedAt: new Date(), version: sql`${tagRelations.version} + 1` })
          .where(eq(tagRelations.id, deletedRelation.id))
          .returning();
        
        if (!updatedRelation) {
          throw new Error(`Failed to reactivate tag relation ${deletedRelation.id}.`);
        }
        
        const userIdToLog = await getUserIdForOperation(db, serverService, storyId, currentUserId);
        await recordLocalOperation(db, storyId, userIdToLog, 'update', 'TagRelation', updatedRelation.id, { isDeleted: false, version: updatedRelation.version });
        entityEventEmitter.emit('tag_relation_changed', storyId, relationId);
        return;
      }

      // Create new relation
      const newRelation = prepareNewEntityData<TagRelationInsert>({
        storyId,
        relationId,
        relationType,
        tagId,
      });

      const result = await db.insert(tagRelations).values(newRelation).returning().get();

      const userIdToLog = await getUserIdForOperation(db, serverService, storyId, currentUserId);
      await recordLocalOperation(db, storyId, userIdToLog, 'create', 'TagRelation', result.id, { ...result });
      entityEventEmitter.emit('tag_relation_changed', storyId, relationId);
    },

    async removeTagFromEntity(currentUserId, storyId, entityId, entityType, tagId): Promise<void> {
      const relationToDelete = await db.query.tagRelations.findFirst({
        where: and(
          eq(tagRelations.storyId, storyId),
          eq(tagRelations.relationId, entityId),
          eq(tagRelations.relationType, entityType),
          eq(tagRelations.tagId, tagId),
          eq(tagRelations.isDeleted, false)
        ),
      });

      if (!relationToDelete) {
        console.warn(`Tag relation for entity ${entityId} with tag ${tagId} not found or already deleted.`);
        return;
      }

      const [updatedRelation] = await db.update(tagRelations)
        .set({ isDeleted: true, deletedAt: new Date(), updatedAt: new Date(), version: sql`${tagRelations.version} + 1` })
        .where(eq(tagRelations.id, relationToDelete.id))
        .returning();
      
      if (!updatedRelation) {
        throw new Error(`Failed to delete tag relation ${relationToDelete.id}.`);
      }

      const userIdToLog = await getUserIdForOperation(db, serverService, storyId, currentUserId);
      await recordLocalOperation(db, storyId, userIdToLog, 'delete', 'TagRelation', updatedRelation.id, { isDeleted: true, version: updatedRelation.version });
      entityEventEmitter.emit('tag_relation_changed', storyId, entityId);
    },

    async updateTagsForEntity(currentUserId, storyId, entityId, entityType, newTagIds): Promise<void> {
      const existingTags = await this.getTagsForEntity(storyId, entityId, entityType);
      const existingTagIds = existingTags.map(tag => tag.id);

      const tagsToAdd = newTagIds.filter(tagId => !existingTagIds.includes(tagId));
      const tagsToRemove = existingTagIds.filter(tagId => !newTagIds.includes(tagId));

      for (const tagId of tagsToAdd) {
        await this.addTagToEntity(currentUserId, storyId, entityId, entityType, tagId);
      }

      for (const tagId of tagsToRemove) {
        await this.removeTagFromEntity(currentUserId, storyId, entityId, entityType, tagId);
      }
    },
  };
};