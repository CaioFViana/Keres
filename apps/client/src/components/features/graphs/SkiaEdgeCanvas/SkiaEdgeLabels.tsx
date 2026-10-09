import { RoundedRect, Text as SkiaText } from '@shopify/react-native-skia';
import type { SkFont } from '@shopify/react-native-skia';
import type { ThemeColors } from '@keres/shared/theme/ThemeColors';
import React from 'react';
import { measureEdgeLabelWidth } from './measureEdgeLabelWidth';

interface SkiaEdgeLabelsProps {
  edges: { id: string; label: string; labelPosition: { x: number; y: number } }[];
  font: SkFont;
  /** Labels longer than this are cut with an ellipsis. */
  maxChars: number;
  /** Average width of a character at 10px - only to size each label's background. */
  charWidth: number;
  colors: Pick<ThemeColors, 'background' | 'textSecondary'>;
}

/**
 * The edge labels of a graph canvas, drawn as Skia chips inside the edges overlay (a child of
 * `SkiaEdgeCanvas`, so the camera applies to them). The caller decides whether they show at all.
 */
const SkiaEdgeLabels = ({ edges, font, maxChars, charWidth, colors }: SkiaEdgeLabelsProps) => (
  <>
    {edges.map((edge) => {
      const label = edge.label.trim();
      if (!label) return null;
      const clipped = label.length > maxChars ? `${label.slice(0, maxChars - 1)}…` : label;
      const width = clipped.length * charWidth + 10;
      // Skia has no `textAnchor`: center by measured width instead. Both place the
      // baseline at the same y.
      const textWidth = measureEdgeLabelWidth(font, clipped, 10);
      return (
        <React.Fragment key={`label-${edge.id}`}>
          <RoundedRect
            x={edge.labelPosition.x - width / 2}
            y={edge.labelPosition.y - 8}
            width={width}
            height={16}
            r={4}
            color={colors.background}
            opacity={0.92}
          />
          <SkiaText
            x={edge.labelPosition.x - textWidth / 2}
            y={edge.labelPosition.y + 4}
            font={font}
            text={clipped}
            color={colors.textSecondary}
          />
        </React.Fragment>
      );
    })}
  </>
);

export default SkiaEdgeLabels;
