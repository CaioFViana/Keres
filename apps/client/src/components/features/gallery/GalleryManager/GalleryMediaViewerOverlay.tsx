import React from 'react';
import ThemedFullscreenModal from '@/src/components/layout/ThemedFullscreenModal/ThemedFullscreenModal';
import GalleryDetailContent from '../../../../screens/gallery/GalleryDetailContent';
import { useGalleryMediaViewerStore } from '../../../../state/galleryMediaViewerStore';

/**
 * Monta a mídia "espiada" de uma tela de entidade, por cima de tudo, sem passar pela
 * navegação. Ver `state/galleryMediaViewerStore.ts` e `GalleryDetailContent.tsx` para o
 * motivo de existir (evitar o reset de pilha acionado por perda de foco do Drawer).
 *
 * Fica montado uma vez, como irmão do Drawer em `MainSystemNavigator` - o `Modal` cuida de
 * aparecer por cima e de tratar o botão físico de voltar do Android (`onRequestClose`).
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
