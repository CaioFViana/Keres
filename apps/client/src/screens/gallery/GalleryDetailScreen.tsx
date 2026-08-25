import type { RouteProp } from '@react-navigation/native';
import { useNavigation, useRoute } from '@react-navigation/native';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useBackButtonHandler } from '../../hooks/useBackButtonHandler';
import type { GalleryStackParamList } from '../../navigation/MainSystemStack';
import { useDocumentTitle } from '../../utils/documentTitle';
import GalleryDetailContent from './GalleryDetailContent';

type GalleryDetailRouteProp = RouteProp<GalleryStackParamList, 'GalleryDetail'>;

/**
 * Adapts `GalleryDetailContent` to real navigation: used only when the medium is opened
 * inside the Gallery tab itself (by tapping a thumbnail in the list). The "peek" coming from
 * an entity screen uses `GalleryMediaViewerOverlay`, which mounts the same content without
 * navigation - see the comment in `GalleryDetailContent.tsx` for why.
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
