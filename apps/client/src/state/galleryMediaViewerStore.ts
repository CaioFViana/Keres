import { create } from 'zustand';

/**
 * It controls "peeking" at a gallery media file from an entity's screen.
 *
 * Global and simple state on purpose - no React Navigation here. `GalleryMediaViewerOverlay` reads
 * `galleryId` and shows the content inside a `Modal`; a `Modal` does not take part in React
 * Navigation's focus, so opening/closing through here never triggers the `blur` listeners each Drawer
 * tab uses to reset its own stack to the list (see `GalleryDetailContent.tsx` for the full history of
 * why that matters).
 */
interface GalleryMediaViewerState {
  galleryId: string | null;
  open: (galleryId: string) => void;
  close: () => void;
}

export const useGalleryMediaViewerStore = create<GalleryMediaViewerState>((set) => ({
  galleryId: null,
  open: (galleryId) => set({ galleryId }),
  close: () => set({ galleryId: null }),
}));
