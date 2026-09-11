import { entityEventEmitter } from '../../utils/EventEmitter';
import { createKeresAxiosInstance } from '../apiClient';
import { authTokenManager } from '../AuthTokenManager';
import { createServerService } from '../ServerService';
import { createSyncConflictService } from '../SyncConflictService';
import { SyncEngineService, type SyncEngineDependencies } from '../SyncEngineService';
import {
  downloadAndImportStory,
  fetchServerStoryPreviews,
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
    downloadAndImportStory: (db, queriedServerId, storyId, userId, role) =>
      downloadAndImportStory(db, queriedServerId, storyId, userId, role, notifier),
    uploadNewStoryToServer,
  };
};

/** Application-scoped instance. The service itself has no global ownership policy. */
export const createAppSyncEngine = (): SyncEngineService =>
  new SyncEngineService(createAppSyncEngineDependencies());

export const syncEngine = createAppSyncEngine();
