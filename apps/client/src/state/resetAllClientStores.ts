import { useBoardDraftStore } from './boardDraftStore';
import { useChapterStore } from './chapterStore';
import { useCharacterStore } from './characterStore';
import { useConnectivityStore } from './connectivityStore';
import { useGalleryMediaViewerStore } from './galleryMediaViewerStore';
import { useGalleryStore } from './galleryStore';
import { useItemStore } from './itemStore';
import { useLocationMapDraftStore } from './locationMapDraftStore';
import { useLocationStore } from './locationStore';
import { useNoteStore } from './noteStore';
import { useNotificationStore } from './notificationStore';
import { useSceneStore } from './sceneStore';
import { useStoryListStore } from './storyListStore';
import { useStoryStore } from './storyStore';
import { useSummaryStore } from './summaryStore';
import { useSyncConflictStore } from './syncConflictStore';
import { useTagStore } from './tagStore';
import { useWorldRuleStore } from './worldRuleStore';

/** Clears every store that can retain data tied to the SQLite database being reset. */
export function resetAllClientStores(): void {
  useStoryStore.getState().setSelectedStory(null);
  useStoryListStore.getState().setStories([]);
  useSummaryStore.getState().clearSummary();
  useSyncConflictStore.getState().reset();
  useBoardDraftStore.getState().reset();
  useLocationMapDraftStore.getState().reset();
  useConnectivityStore.getState().reset();
  useNotificationStore.getState().clearAll();
  useGalleryMediaViewerStore.getState().close();

  useChapterStore.getState().resetStore();
  useCharacterStore.getState().resetStore();
  useGalleryStore.getState().resetStore();
  useItemStore.getState().resetStore();
  useLocationStore.getState().resetStore();
  useNoteStore.getState().resetStore();
  useSceneStore.getState().resetStore();
  useTagStore.getState().resetStore();
  useWorldRuleStore.getState().resetStore();
}
