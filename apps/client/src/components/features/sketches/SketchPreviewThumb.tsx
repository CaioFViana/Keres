import {
  decodeSketchDocument,
  getEntityAppearance,
  validateSketchContent,
  type SketchContentType,
  type SketchDocument,
} from '@keres/shared';
import { Ionicons } from '@expo/vector-icons';
import { Canvas, ImageSVG, Skia } from '@shopify/react-native-skia';
import React, { useMemo } from 'react';
import { Image, Platform, View } from 'react-native';
import { useTheme, type ThemeColors } from '@/src/theme';
import { renderSketchSvg } from '@/src/utils/sketchSvg';
import type { SvgExportColors } from '@/src/utils/svgExport';

interface SketchPreviewThumbProps {
  sketch: { name: string; content: SketchContentType };
  size?: number;
  borderRadius?: number;
  /** Keep the list row's gutter; the picker lays out its own. */
  gutter?: boolean;
}

/** The look a display preview is drawn with: what the canvas shows under this theme. */
export function sketchLookFromTheme(colors: ThemeColors): {
  colors: SvgExportColors;
  paper: string;
} {
  return {
    colors: {
      background: colors.background,
      surface: colors.surface,
      text: colors.text,
      textSecondary: colors.textSecondary,
      border: colors.border,
      primary: colors.primary,
    },
    paper: colors.surface,
  };
}

/** A decoded drawing, or `null` when the stored content is corrupt. */
function safeDecode(content: SketchContentType): SketchDocument | null {
  try {
    return decodeSketchDocument(validateSketchContent(content));
  } catch {
    return null;
  }
}

/** Whether the drawing has anything to show: an empty page draws the icon, like a missing cover did. */
function hasDrawing(doc: SketchDocument): boolean {
  return (
    doc.overlays.length > 0 || doc.layers.some((layer) => layer.visible && layer.items.length > 0)
  );
}

/** An `Image`-ready data URI of the drawing. The browser decodes it synchronously. */
function sketchDataUri(xml: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(xml)}`;
}

/** Fits the page in the square box, centered, without distorting it. */
function containBox(pageWidth: number, pageHeight: number, size: number) {
  const scale = Math.min(size / pageWidth, size / pageHeight);
  const width = pageWidth * scale;
  const height = pageHeight * scale;
  return { x: (size - width) / 2, y: (size - height) / 2, width, height };
}

/**
 * The sketch's drawing under the current theme, rendered straight from its content: no file,
 * no Gallery row, nothing to go stale. A theme change repaints it on the next render, and a
 * save shows up by itself because the content changed.
 */
const SketchPreviewThumb: React.FC<SketchPreviewThumbProps> = ({
  sketch,
  size = 48,
  borderRadius = 8,
  gutter = true,
}) => {
  const { colors } = useTheme();
  const drawing = useMemo(() => {
    const doc = safeDecode(sketch.content);
    if (!doc || !hasDrawing(doc)) return null;
    const look = sketchLookFromTheme(colors);
    return {
      xml: renderSketchSvg(doc, {
        title: sketch.name,
        colors: look.colors,
        paper: look.paper,
      }),
      pageWidth: doc.page.width,
      pageHeight: doc.page.height,
    };
  }, [sketch.content, sketch.name, colors]);
  const nativeSvg = useMemo(
    () => (Platform.OS !== 'web' && drawing ? Skia.SVG.MakeFromString(drawing.xml) : null),
    [drawing],
  );

  const frame = {
    width: size,
    height: size,
    borderRadius,
    marginRight: gutter ? 12 : 0,
    backgroundColor: colors.border,
  };
  if (drawing && Platform.OS === 'web') {
    return (
      <Image
        source={{ uri: sketchDataUri(drawing.xml) }}
        style={frame}
        resizeMode="contain"
        accessibilityLabel={sketch.name}
      />
    );
  }
  if (drawing && nativeSvg) {
    const box = containBox(drawing.pageWidth, drawing.pageHeight, size);
    return (
      <View style={frame} accessibilityLabel={sketch.name}>
        <Canvas style={{ width: size, height: size }}>
          <ImageSVG svg={nativeSvg} x={box.x} y={box.y} width={box.width} height={box.height} />
        </Canvas>
      </View>
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
