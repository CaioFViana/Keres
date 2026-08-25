import React from 'react';
import ThemedFullscreenModal from '@/src/components/layout/ThemedFullscreenModal/ThemedFullscreenModal';
import GalleryDetailContent from '../../../../screens/gallery/GalleryDetailContent';
import { useGalleryMediaViewerStore } from '../../../../state/galleryMediaViewerStore';

/**
 * Mounts the medium "peeked at" from an entity screen, on top of everything, without going through
 * navigation. See `state/galleryMediaViewerStore.ts` and `GalleryDetailContent.tsx` for the
 * reason it exists (avoiding the stack reset triggered by losing the Drawer's focus).
 *
 * It stays mounted once, as a sibling of the Drawer in `MainSystemNavigator` - the `Modal` takes care of
 * appearing on top and of handling Android's physical back button (`onRequestClose`).
 */
const GalleryMediaViewerOverlay: React.FC = () => {
  const galleryId = useGalleryMediaViewerStore((state) => state.galleryId);
  const close = useGalleryMediaViewerStore((state) => state.close);

  return (
    <ThemedFullscreenModal visible={galleryId !== null} onRequestClose={close}>
      {galleryId && (
        <GalleryDetailContent
          key={galleryId}
          galleryId={galleryId}
          onClose={close}
          showCloseButton
        />
      )}
    </ThemedFullscreenModal>
  );
};

export default GalleryMediaViewerOverlay;
