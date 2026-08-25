import { useCallback } from 'react';
import { useGalleryMediaViewerStore } from '../state/galleryMediaViewerStore';

/**
 * Opens a gallery medium on top of the current screen - without navigating.
 *
 * Historically this tried two real forms of navigation (inside the Gallery tab,
 * then on the root stack) and both broke the back button in a different
 * way: the first gave back the gallery list instead of the entity screen; the second
 * fixed that but made the entity screen ITSELF lose the Drawer's focus, triggering that
 * tab's stack reset (see `GalleryDetailContent.tsx`) and giving back the entity's
 * list instead of the detail. The root cause of both is the same: any real navigation
 * out of the current tab moves the focus of something that should not change.
 *
 * That is why the medium is now just a `Modal` (`GalleryMediaViewerOverlay`) driven by
 * simple state, outside React Navigation - nothing loses focus, nothing resets.
 */
export function useOpenGalleryMediaViewer() {
  const open = useGalleryMediaViewerStore((state) => state.open);
  return useCallback((galleryId: string) => open(galleryId), [open]);
}
