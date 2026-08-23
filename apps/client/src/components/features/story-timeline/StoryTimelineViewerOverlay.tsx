import React from 'react';
import ThemedFullscreenModal from '@/src/components/layout/ThemedFullscreenModal/ThemedFullscreenModal';
import { useStoryTimelineViewerStore } from '@/src/state/storyTimelineViewerStore';
import StoryTimelineViewerContent from './StoryTimelineViewerContent';

const StoryTimelineViewerOverlay: React.FC = () => {
  const isOpen = useStoryTimelineViewerStore((state) => state.isOpen);
  const close = useStoryTimelineViewerStore((state) => state.close);
  return (
    <ThemedFullscreenModal visible={isOpen} onRequestClose={close}>
      {isOpen && <StoryTimelineViewerContent onClose={close} />}
    </ThemedFullscreenModal>
  );
};
export default StoryTimelineViewerOverlay;
