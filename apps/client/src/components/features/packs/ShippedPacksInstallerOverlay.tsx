import React from 'react';
import ThemedFullscreenModal from '@/src/components/layout/ThemedFullscreenModal/ThemedFullscreenModal';
import ShippedPacksContent from '../../../screens/packs/ShippedPacksContent';
import { useShippedPacksInstallerStore } from '../../../state/shippedPacksInstallerStore';

/**
 * Mounts the shipped-packs catalogue offered from the story form, on top of everything, without
 * going through navigation. See `state/shippedPacksInstallerStore.ts` and
 * `ShippedPacksContent.tsx` for the reason it exists (installing without abandoning the
 * half-filled form underneath).
 *
 * It stays mounted once, as a sibling of the Drawer in `StorySelectionNavigator` - the `Modal`
 * takes care of appearing on top and of handling Android's physical back button (`onRequestClose`).
 */
const ShippedPacksInstallerOverlay: React.FC = () => {
  const open = useShippedPacksInstallerStore((state) => state.open);
  const closeInstaller = useShippedPacksInstallerStore((state) => state.closeInstaller);

  return (
    <ThemedFullscreenModal visible={open} onRequestClose={closeInstaller}>
      <ShippedPacksContent onClose={closeInstaller} showCloseButton />
    </ThemedFullscreenModal>
  );
};

export default ShippedPacksInstallerOverlay;
