import type { CreateStoryUpdate, StoryUpdate, UpdateStoryUpdate } from '@keres/shared';
import { omitClientProtectedFields } from '../entityTableRegistry';

/** Returns the entity version on which a local resulting version was based. */
export function deriveBaseVersion(payload: Record<string, any>): number | undefined {
  const resultingVersion = payload?.version;
  return typeof resultingVersion === 'number' && resultingVersion >= 1
    ? resultingVersion - 1
    : undefined;
}

export function syncEntityKey(entityType: string, entityId: string): string {
  return `${entityType}:${entityId}`;
}

/** Removes local bookkeeping columns before a server update reaches a client handler. */
export function protectRemoteUpdate(update: StoryUpdate): StoryUpdate {
  if (update.type === 'create') {
    return {
      ...update,
      data: omitClientProtectedFields(update.entity, update.data),
    } as CreateStoryUpdate;
  }
  if (update.type === 'update') {
    return {
      ...update,
      changes: omitClientProtectedFields(update.entity, update.changes),
    } as UpdateStoryUpdate;
  }
  return update;
}
