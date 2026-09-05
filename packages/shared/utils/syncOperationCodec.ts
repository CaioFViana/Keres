import type {
  ChapterReorderingStoryUpdate,
  StoryReorderingStoryUpdate,
  StoryUpdate,
} from '../schemas/SyncSchemas';

/** Metadata common to a persisted operation-log row after a host has read it from storage. */
export type PulledSyncOperationMetadata = {
  id: string;
  version: number;
  operationVersion: number;
  operationTime: string;
  originatingUser: string;
  operationId: string;
};

/**
 * Extracts the protocol-owned portion of a reorder for an operation log. Hosts retain their
 * database-specific metadata and sanitization rules, but must never independently decide which
 * Story reorder qualifiers survive persistence.
 */
export function encodeReorderOperationPayload(
  update: ChapterReorderingStoryUpdate | StoryReorderingStoryUpdate,
): Record<string, unknown> {
  if (update.entity === 'Chapter') return { reorderItems: update.reorderItems };
  return {
    reorderItems: update.reorderItems,
    ...(update.reorderTarget ? { reorderTarget: update.reorderTarget } : {}),
    ...(update.schemaEntityType ? { schemaEntityType: update.schemaEntityType } : {}),
  };
}

/**
 * Rebuilds the two entity-owned reorder wire formats from their common operation-log payload.
 * Storage hosts supply only primitive values, allowing API and client code to share this protocol
 * rule without sharing database code.
 */
export function decodePulledReorderOperation(
  entityType: string,
  payload: Record<string, unknown>,
  metadata: PulledSyncOperationMetadata,
): StoryUpdate {
  const reorderItems = (payload.reorderItems ?? []) as { id: string; newIndex: number }[];
  if (entityType === 'Chapter') {
    return {
      type: 'reorder',
      entity: 'Chapter',
      reorderItems,
      ...metadata,
    } as ChapterReorderingStoryUpdate;
  }
  if (entityType === 'Story') {
    return {
      type: 'reorder',
      entity: 'Story',
      reorderItems,
      reorderTarget: payload.reorderTarget as 'StorySchemaField' | 'Event' | 'Stat' | undefined,
      schemaEntityType: payload.schemaEntityType as string | undefined,
      ...metadata,
    } as StoryReorderingStoryUpdate;
  }
  throw new Error(`Unhandled reorder entity type: ${entityType}`);
}
