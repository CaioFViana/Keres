import type { AppDrizzleClient } from '@/src/db';
import type { KeresAxiosInstance } from '@/src/services/apiClient';
import type { SyncConflictService } from '@/src/services/SyncConflictService';
import type { SyncNotifier } from './SyncNotifier';

/** Mutable sync state exposed through getters so modules always see the current configuration. */
export interface SyncContext {
  db: () => AppDrizzleClient;
  storyId: () => string;
  client: () => KeresAxiosInstance;
  conflictService: () => SyncConflictService;
  notifier: () => SyncNotifier;
  /** Aborted when the scheduler stops the active cycle (context switch / stopAndWait). */
  abortSignal: () => AbortSignal;
}
