import { useCallback } from 'react';
import { useGalleryMediaViewerStore } from '../state/galleryMediaViewerStore';

/**
 * Abre uma mídia da galeria por cima da tela atual - sem navegar.
 *
 * Historicamente isto tentou duas formas de navegação de verdade (dentro da aba de
 * Galeria, depois na pilha raiz) e as duas quebravam o botão de voltar de um jeito
 * diferente: a primeira devolvia a lista de galeria em vez da tela de entidade; a segunda
 * corrigia isso mas fazia a PRÓPRIA tela de entidade perder o foco do Drawer, acionando o
 * reset de pilha daquela aba (ver `GalleryDetailContent.tsx`) e devolvendo a lista da
 * entidade em vez do detalhe. A causa raiz dos dois é a mesma: qualquer navegação real
 * para fora da aba atual mexe no foco de alguma coisa que não deveria mudar.
 *
 * Por isso a mídia agora é só um `Modal` (`GalleryMediaViewerOverlay`) controlado por
 * estado simples, fora do React Navigation - nada perde foco, nada reseta.
 */
export function useOpenGalleryMediaViewer() {
  const open = useGalleryMediaViewerStore((state) => state.open);
  return useCallback((galleryId: string) => open(galleryId), [open]);
}
