import { getEntityAppearance, type SketchContentType } from '@keres/shared';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import React from 'react';
import { useSketchPreviewUri } from '@/src/hooks/useSketchPreviewUri';
import { useTheme } from '@/src/theme';

interface SketchPreviewThumbProps {
  sketch: { name: string; content: SketchContentType };
  size?: number;
  borderRadius?: number;
  /** Keep the list row's gutter; the picker lays out its own. */
  gutter?: boolean;
}

/**
 * The sketch's cached preview under the current theme, or its icon while the preview draws.
 * The file lives outside the Gallery and never syncs; every device draws its own.
 */
const SketchPreviewThumb: React.FC<SketchPreviewThumbProps> = ({
  sketch,
  size = 48,
  borderRadius = 8,
  gutter = true,
}) => {
  const { colors } = useTheme();
  const uri = useSketchPreviewUri(sketch);
  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={{
          width: size,
          height: size,
          borderRadius,
          marginRight: gutter ? 12 : 0,
          backgroundColor: colors.border,
        }}
        contentFit="cover"
        accessibilityLabel={sketch.name}
      />
    );
  }
  const appearance = getEntityAppearance('Sketch');
  return (
    <Ionicons
      name={appearance.icon as keyof typeof Ionicons.glyphMap}
      size={24}
      color={appearance.color}
      style={{ marginRight: gutter ? 12 : 0 }}
    />
  );
};

export default SketchPreviewThumb;
