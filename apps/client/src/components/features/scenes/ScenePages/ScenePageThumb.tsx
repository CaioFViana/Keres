import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import SketchPreviewThumb from '@/src/components/features/sketches/SketchPreviewThumb';
import { useGalleryRow } from '@/src/hooks/useGalleryMedia';
import { useResolvedMediaUri } from '@/src/hooks/useResolvedMediaUri';
import { useTheme } from '@/src/theme';
import type { ScenePageView } from '@/src/hooks/useScenePages';

interface ScenePageThumbProps {
  /** The Gallery medium to draw; `null` draws the placeholder. */
  galleryId: string | null;
  /** The Sketch to draw instead of a medium; wins over it. */
  sketch?: ScenePageView['sketch'];
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
  sketch = null,
  width,
  height,
  fit = 'contain',
  removed = false,
  label,
}) => {
  const { colors } = useTheme();
  const shown = useGalleryRow(sketch ? null : galleryId);
  const uri = useResolvedMediaUri(shown?.localPath);
  const frame = { width, height, borderRadius: 6, backgroundColor: colors.border };

  if (sketch) {
    return (
      <SketchPreviewThumb
        sketch={sketch}
        size={Math.min(width, height)}
        borderRadius={6}
        gutter={false}
      />
    );
  }
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
