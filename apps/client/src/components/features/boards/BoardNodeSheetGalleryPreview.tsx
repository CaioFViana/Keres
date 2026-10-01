import { Image } from 'expo-image';
import React, { useMemo, useState } from 'react';
import { StyleSheet, TouchableOpacity } from 'react-native';
import ImageZoomViewer from '../media/MediaPlayer/ImageZoomViewer';
import { useResolvedMediaUri } from '../../../hooks/useResolvedMediaUri';
import { useTheme } from '../../../theme';
import {
  galleryDisplayPath,
  galleryHasImage,
  type BoardGalleryMedia,
} from '../../../utils/boardLayout';

interface Props {
  /** The gallery's media, when the sheet's pin is a Gallery pin - otherwise nothing renders. */
  galleryMedia?: BoardGalleryMedia | null;
}

/**
 * The picture at the top of a Gallery pin's sheet, with the same tap-to-zoom fullscreen viewer
 * the gallery detail screen uses (`ImageZoomViewer`: pinch zoom, drag, double tap).
 */
const BoardNodeSheetGalleryPreview: React.FC<Props> = ({ galleryMedia }) => {
  const { colors } = useTheme();
  const [zoomVisible, setZoomVisible] = useState(false);
  // Unconditional: the early return below would otherwise skip this hook on some renders.
  const resolvedUri = useResolvedMediaUri(galleryDisplayPath(galleryMedia));

  const styles = useMemo(
    () =>
      StyleSheet.create({
        preview: {
          width: '100%',
          aspectRatio: 1,
          borderRadius: 8,
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.border,
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          marginBottom: 12,
        },
        image: {
          width: '100%',
          height: '100%',
        },
      }),
    [colors],
  );

  if (!galleryHasImage(galleryMedia)) return null;

  return (
    <>
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={() => setZoomVisible(true)}
        disabled={!resolvedUri}
        style={styles.preview}
        testID="board-gallery-preview"
      >
        <Image
          source={resolvedUri ? { uri: resolvedUri } : undefined}
          style={styles.image}
          contentFit="contain"
        />
      </TouchableOpacity>
      {resolvedUri && (
        <ImageZoomViewer
          visible={zoomVisible}
          uri={resolvedUri}
          onClose={() => setZoomVisible(false)}
        />
      )}
    </>
  );
};

export default BoardNodeSheetGalleryPreview;
