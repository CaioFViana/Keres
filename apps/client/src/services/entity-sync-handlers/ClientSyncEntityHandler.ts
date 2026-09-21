import type { CreateStoryUpdate, DeleteStoryUpdate, UpdateStoryUpdate } from '@keres/shared';
import type { AppDrizzleClient } from '../../db';

/**
 * Contract every entity's pull-path handler implements (see `registerClientSyncHandlers`).
 *
 * The sync engine calls `applyCreate`/`applyUpdate`/`applyDelete` with remote operations
 * already stripped of local bookkeeping (`protectRemoteUpdate`); handlers translate them
 * into Drizzle writes via `toEntityColumns`. The database handle arrives later through
 * `setDb`, because the engine is constructed before the database is bound.
 */
export interface ClientSyncEntityHandler {
  entityName: string;
  setDb(dbInstance: AppDrizzleClient): void;
  /**
   * NOTE: the first parameter receives the active *story* id at every call site
   * (`SyncPull`/`SyncEngineService`), even though this interface names it `entityId`.
   * Implementations already name it `storyId`; do not pass an entity id here.
   */
  applyCreate(entityId: string, update: CreateStoryUpdate): Promise<void>;
  applyUpdate(entityId: string, update: UpdateStoryUpdate): Promise<void>;
  applyDelete(entityId: string, update: DeleteStoryUpdate): Promise<void>;
  /** Local read used to detect already-applied creates and to snapshot favorites. */
  getById(id: string): Promise<any | undefined>;
}
