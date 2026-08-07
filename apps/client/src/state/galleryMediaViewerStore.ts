import { create } from 'zustand';

/**
 * Controla o "espiar" uma mídia da galeria a partir de uma tela de entidade.
 *
 * Estado global e simples de propósito - nada de React Navigation aqui. `GalleryMediaViewerOverlay`
 * lê `galleryId` e mostra o conteúdo dentro de um `Modal`; um `Modal` não participa do foco
 * do React Navigation, então abrir/fechar por aqui nunca aciona os listeners de `blur` que
 * cada aba do Drawer usa para resetar sua própria pilha para a lista (ver
 * `GalleryDetailContent.tsx` para o histórico completo do porquê disso importa).
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
