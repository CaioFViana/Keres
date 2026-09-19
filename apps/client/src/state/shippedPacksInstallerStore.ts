import { create } from 'zustand';

/**
 * Controls the shipped-packs installer overlay opened from the story form.
 *
 * Global and simple state on purpose - no React Navigation here. `ShippedPacksInstallerOverlay`
 * reads `open` and shows `ShippedPacksContent` inside a `Modal`; a `Modal` does not take part in
 * React Navigation's focus, so installing from the story form never disturbs the half-filled form
 * underneath - the same reason `GalleryMediaViewerOverlay` exists.
 *
 * `lastInstalledPackId` is the way back: the modal never refocuses the form, so the form's pack
 * list would otherwise stay frozen at whatever it loaded on mount. The content reports each
 * successful install here, and the form refetches (and pre-selects the newcomer) when it changes.
 */
interface ShippedPacksInstallerState {
  open: boolean;
  lastInstalledPackId: string | null;
  openInstaller: () => void;
  closeInstaller: () => void;
  markInstalled: (packId: string) => void;
}

export const useShippedPacksInstallerStore = create<ShippedPacksInstallerState>((set) => ({
  open: false,
  lastInstalledPackId: null,
  openInstaller: () => set({ open: true }),
  closeInstaller: () => set({ open: false }),
  markInstalled: (packId) => set({ lastInstalledPackId: packId }),
}));
