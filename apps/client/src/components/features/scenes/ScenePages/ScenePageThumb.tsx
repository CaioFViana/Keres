import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useDrizzle } from '@/src/db';
import type { GallerySelect } from '@/src/db/schema';
import { useResolvedMediaUri } from '@/src/hooks/useResolvedMediaUri';
import { createGalleryService } from '@/src/services/storymanagement/GalleryService';
import { useTheme } from '@/src/theme';

interface ScenePageThumbProps {
  /** The Gallery medium to draw; `null` draws the placeholder. */
  galleryId: string | null;
  width: number;
  height: number;
  fit?: 'contain' | 'cover';
  /** The image is gone: a different placeholder, so a missing picture is not mistaken for a blank one. */
  removed?: boolean;
  label?: string;
}

/** The image of a page in a fixed frame, drawn the way the page's fit says. */
const ScenePageThumb: React.FC<ScenePageThumbProps> = ({
  galleryId,
  width,
  height,
  fit = 'contain',
  removed = false,
  label,
}) => {
  const { colors } = useTheme();
  const db = useDrizzle();
  const [row, setRow] = useState<GallerySelect | null>(null);

  useEffect(() => {
    let alive = true;
    if (!galleryId) return;
    void createGalleryService(db)
      .getById(galleryId)
      .then((found) => {
        if (alive) setRow(found && !found.isDeleted ? found : null);
      })
      .catch(() => {
        if (alive) setRow(null);
      });
    return () => {
      alive = false;
    };
  }, [db, galleryId]);

  const shown = galleryId && row && row.id === galleryId ? row : null;
  const uri = useResolvedMediaUri(shown?.localPath);
  const frame = { width, height, borderRadius: 6, backgroundColor: colors.border };

  if (shown && uri) {
    return (
      <Image
        source={{ uri }}
        style={frame}
        contentFit={fit}
        accessibilityLabel={label ?? shown.title ?? shown.fileName}
      />
    );
  }
  return (
    <View style={[frame, styles.center]} accessibilityLabel={label}>
      <Ionicons
        name={removed ? 'alert-circle-outline' : 'image-outline'}
        size={Math.min(width, height) / 3}
        color={removed ? colors.error : colors.textSecondary}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
});

export default ScenePageThumb;
