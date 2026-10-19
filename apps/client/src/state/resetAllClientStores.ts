import { useBoardDraftStore } from './drafts/boardDraftStore';
import { useChapterStore } from './story/chapterStore';
import { useCharacterStore } from './story/characterStore';
import { useConnectivityStore } from './sync/connectivityStore';
import { useGalleryMediaViewerStore } from './ui/galleryMediaViewerStore';
import { useGalleryStore } from './story/galleryStore';
import { useGuideStore } from './ui/guideStore';
import { useItemStore } from './story/itemStore';
import { useLocationMapDraftStore } from './drafts/locationMapDraftStore';
import { useLocationStore } from './story/locationStore';
import { useMusicToolsStore } from './drafts/musicToolsStore';
import { useNoteStore } from './story/noteStore';
import { useNotificationStore } from './ui/notificationStore';
import { usePlanUsageStore } from './app/planUsageStore';
import { useSceneStore } from './story/sceneStore';
import { useSketchDraftStore } from './drafts/sketchDraftStore';
import { useStoryListStore } from './story/storyListStore';
import { useStoryStore } from './story/storyStore';
import { useSummaryStore } from './story/summaryStore';
import { useSyncConflictStore } from './sync/syncConflictStore';
import { useTagStore } from './story/tagStore';
import { useUnseenMessagesStore } from './ui/unseenMessagesStore';
import { useWorldRuleStore } from './story/worldRuleStore';

/** Clears every store that can retain data tied to the SQLite database being reset. */
export function resetAllClientStores(): void {
  useStoryStore.getState().setSelectedStory(null);
  useStoryListStore.getState().setStories([]);
  useSummaryStore.getState().clearSummary();
  useSyncConflictStore.getState().reset();
  useBoardDraftStore.getState().reset();
  useSketchDraftStore.getState().reset();
  useLocationMapDraftStore.getState().reset();
  useConnectivityStore.getState().reset();
  useNotificationStore.getState().clearAll();
  useGalleryMediaViewerStore.getState().close();
  useGuideStore.getState().reset();
  useUnseenMessagesStore.getState().reset();
  useMusicToolsStore.getState().reset();
  usePlanUsageStore.getState().clear();

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
