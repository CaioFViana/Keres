import { entityEventEmitter } from '@/src/state/events/EventEmitter';
import { createKeresAxiosInstance } from '@/src/services/apiClient';
import { authTokenManager } from '@/src/services/AuthTokenManager';
import { createServerService } from '@/src/services/ServerService';
import { createSyncConflictService } from '@/src/services/SyncConflictService';
import { SyncEngineService, type SyncEngineDependencies } from '@/src/services/SyncEngineService';
import {
  downloadAndImportStory,
  fetchServerStoryPreviews,
  fetchServerStoryPreviewsOrNull,
  uploadNewStoryToServer,
} from './StoryTransfer';
import { registerClientSyncHandlers } from './registerClientSyncHandlers';
import { createAppSyncNotifier } from './SyncNotifier';

export const createAppSyncEngineDependencies = (): SyncEngineDependencies => {
  const notifier = createAppSyncNotifier();
  return {
    notifier,
    events: {
      emit: (event, ...args) => entityEventEmitter.emit(event, ...args),
    },
    tokenProvider: authTokenManager,
    createClient: (baseURL) => createKeresAxiosInstance(baseURL ? { baseURL } : undefined),
    createEntityHandlers: registerClientSyncHandlers,
    createConflictService: createSyncConflictService,
    createServerService,
    fetchServerStoryPreviews,
    fetchServerStoryPreviewsOrNull,
    downloadAndImportStory: (db, queriedServerId, storyId, userId, role) =>
      downloadAndImportStory(db, queriedServerId, storyId, userId, role, notifier),
    uploadNewStoryToServer,
  };
};

/** Application-scoped instance. The service itself has no global ownership policy. */
export const createAppSyncEngine = (): SyncEngineService =>
  new SyncEngineService(createAppSyncEngineDependencies());

export const syncEngine = createAppSyncEngine();
