import type { SyncEntityHandler } from '@/services/entity-sync-handlers/BaseSyncEntityHandler';
import { tierEnforcementService } from '@/services/TierEnforcementService';

/**
 * Refuses a row that a create, or a restore of a deleted row, would bring into a plan's count: a story against
 * the story ceiling, an entity against the entity ceilings (a type no plan counts is never refused there), a
 * comment against its own cap on the story. `none` is held to nothing.
 */
export async function assertPlanRoomFor(
  handler: Pick<SyncEntityHandler, 'tierLimitScope'>,
  entity: string,
  userId: string,
  storyId: string,
): Promise<void> {
  if (handler.tierLimitScope === 'story') {
    await tierEnforcementService.assertCanCreateStory(userId);
  } else if (handler.tierLimitScope === 'entity') {
    await tierEnforcementService.assertCanCreateEntity(userId, storyId, entity);
  } else if (handler.tierLimitScope === 'comment') {
    await tierEnforcementService.assertCanCreateComment(userId, storyId);
  }
}
