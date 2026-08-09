import { useChapterStore } from './chapterStore';
import { useCharacterRelationStore } from './characterRelationStore';
import { useCharacterStore } from './characterStore';
import { useChoiceStore } from './choiceStore';
import { useConnectivityStore } from './connectivityStore';
import { useGalleryMediaViewerStore } from './galleryMediaViewerStore';
import { useGalleryStore } from './galleryStore';
import { useItemStore } from './itemStore';
import { useLocationStore } from './locationStore';
import { useNoteStore } from './noteStore';
import { useNotificationStore } from './notificationStore';
import { useSceneStore } from './sceneStore';
import { useStoryListStore } from './storyListStore';
import { useStoryStore } from './storyStore';
import { useSummaryStore } from './summaryStore';
import { useSyncConflictStore } from './syncConflictStore';
import { useTagStore } from './tagStore';
import { worldRuleStore } from './worldRuleStore';

/** Clears every store that can retain data tied to the SQLite database being reset. */
export function resetAllClientStores(): void {
  useStoryStore.getState().setSelectedStory(null);
  useStoryListStore.getState().setStories([]);
  useSummaryStore.getState().clearSummary();
  useSyncConflictStore.getState().reset();
  useConnectivityStore.getState().reset();
  useNotificationStore.getState().clearAll();
  useGalleryMediaViewerStore.getState().close();

  useChapterStore.getState().resetStore();
  useCharacterRelationStore.getState().resetStore();
  useCharacterStore.getState().resetStore();
  useChoiceStore.getState().resetStore();
  useGalleryStore.getState().resetStore();
  useItemStore.getState().resetStore();
  useLocationStore.getState().resetStore();
  useNoteStore.getState().resetStore();
  useSceneStore.getState().resetStore();
  useTagStore.getState().resetStore();
  worldRuleStore.getState().resetStore();
}
