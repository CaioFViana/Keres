import type { AppDrizzleClient } from '../../db';
import type { KeresAxiosInstance } from '../apiClient';
import type { SyncConflictService } from '../SyncConflictService';

/** Mutable sync state exposed through getters so modules always see the current configuration. */
export interface SyncContext {
  db: () => AppDrizzleClient;
  storyId: () => string;
  client: () => KeresAxiosInstance;
  conflictService: () => SyncConflictService;
}
