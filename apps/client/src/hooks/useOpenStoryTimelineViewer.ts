import { useCallback } from 'react';
import { useStoryTimelineViewerStore } from '../state/storyTimelineViewerStore';

export function useOpenStoryTimelineViewer() {
  const open = useStoryTimelineViewerStore((state) => state.open);
  return useCallback(() => open(), [open]);
}
