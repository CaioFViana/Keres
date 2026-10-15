import { Image } from 'expo-image';
import React from 'react';
import { StyleSheet } from 'react-native';
import { useGalleryRow } from '@/src/hooks/media/useGalleryMedia';
import { useResolvedMediaUri } from '@/src/hooks/media/useResolvedMediaUri';
import { useTheme } from '@/src/theme';

interface CoverImageProps {
  /** The Gallery medium that is the cover; without one nothing is drawn but `fallback`. */
  galleryId: string | null | undefined;
  width: number;
  height: number;
  /** Drawn when there is no cover, or its file is not on this device (yet). */
  fallback?: React.ReactNode;
  testID?: string;
}

const Picture: React.FC<Omit<CoverImageProps, 'galleryId'> & { galleryId: string }> = ({
  galleryId,
  width,
  height,
  fallback,
  testID,
}) => {
  const { colors } = useTheme();
  const row = useGalleryRow(galleryId);
  const uri = useResolvedMediaUri(row?.localPath);
  if (!row || !uri) return <>{fallback}</>;
  return (
    <Image
      source={{ uri }}
      style={[styles.picture, { width, height, backgroundColor: colors.border }]}
      contentFit="cover"
      accessibilityIgnoresInvertColors
      accessibilityLabel={row.title ?? row.fileName}
      testID={testID}
    />
  );
};

/**
 * The cover of a story or of a work, in a fixed frame and cropped to fill it. A story with no cover (or whose
 * cover is not on this device) shows what `fallback` says, so a card keeps its shape either way.
 */
const CoverImage: React.FC<CoverImageProps> = ({ galleryId, fallback, ...frame }) =>
  galleryId ? <Picture galleryId={galleryId} fallback={fallback} {...frame} /> : <>{fallback}</>;

const styles = StyleSheet.create({
  picture: { borderRadius: 6 },
});

export default CoverImage;
