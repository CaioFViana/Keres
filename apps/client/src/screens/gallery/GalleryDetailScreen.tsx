import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useBackButtonHandler } from '../../hooks/useBackButtonHandler';
import { GalleryStackParamList } from '../../navigation/MainSystemStack';
import { useDocumentTitle } from '../../utils/documentTitle';
import GalleryDetailContent from './GalleryDetailContent';

type GalleryDetailRouteProp = RouteProp<GalleryStackParamList, 'GalleryDetail'>;

/**
 * Adapta `GalleryDetailContent` à navegação de verdade: usada só quando a mídia é aberta
 * dentro da própria aba de Galeria (tocando uma miniatura na lista). O "espiar" vindo de
 * uma tela de entidade usa `GalleryMediaViewerOverlay`, que monta o mesmo conteúdo sem
 * navegação - ver o comentário em `GalleryDetailContent.tsx` para o porquê.
 */
const GalleryDetailScreen = () => {
  useBackButtonHandler({ showWebBackButton: true });
  const { t } = useTranslation();
  useDocumentTitle(t('gallery_title'));
  const navigation = useNavigation();
  const route = useRoute<GalleryDetailRouteProp>();

  return (
    <GalleryDetailContent
      galleryId={route.params.galleryId}
      onClose={() => navigation.goBack()}
      showCloseButton
    />
  );
};

export default GalleryDetailScreen;
