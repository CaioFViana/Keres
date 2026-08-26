import React, { useMemo } from 'react';
import { View } from 'react-native';

interface CanvasLineProps {
  left: number;
  top: number;
  /** Length of the line. Vertical lines pass their length here too, with `vertical`. */
  length: number;
  thickness: number;
  color: string;
  opacity?: number;
  vertical?: boolean;
  dashed?: boolean;
}

/** Dash and space at the canvas' natural scale, matching the dasharray of the exported SVG. */
const DASH = 5;
const SPACE = 4;
/**
 * A ceiling on how many dashes one line is worth. A proportional timeline spans tens of thousands of
 * points, and honouring the 5/4 rhythm there would mean thousands of views for a single decorative
 * line. Past the ceiling the rhythm stretches instead: the same dash-to-space ratio, longer strokes.
 */
const MAX_DASHES = 80;

/**
 * A straight line on a pan/zoom canvas, drawn with plain views instead of `react-native-svg`.
 *
 * Android's `SvgView` renders itself into an ARGB_8888 bitmap the size of the whole view, so an
 * `<Svg>` that covers one of these canvases asks for `width x height x 4` bytes in one allocation -
 * a proportional timeline (up to 100k points wide) blows past any heap and takes the app down with
 * an OutOfMemoryError inside `onDraw`. Every backdrop these canvases draw is axis-aligned
 * (row bands, rules, ticks, presence threads), so views cost nothing in fidelity and are clipped
 * to the viewport by the parent rather than rasterised whole.
 */
const CanvasLine: React.FC<CanvasLineProps> = ({
  left,
  top,
  length,
  thickness,
  color,
  opacity,
  vertical = false,
  dashed = false,
}) => {
  const span = Math.max(0, length);
  const dashes = useMemo(() => {
    if (!dashed) return [];
    const count = Math.max(1, Math.min(MAX_DASHES, Math.round(span / (DASH + SPACE))));
    const period = span / count;
    return Array.from({ length: count }, (_, index) => ({
      offset: index * period,
      size: Math.max(1, period * (DASH / (DASH + SPACE))),
    }));
  }, [dashed, span]);

  const frame = {
    position: 'absolute' as const,
    left,
    top,
    width: vertical ? thickness : span,
    height: vertical ? span : thickness,
    opacity,
  };

  if (!dashed) {
    return <View pointerEvents="none" style={[frame, { backgroundColor: color }]} />;
  }

  return (
    <View pointerEvents="none" style={frame}>
      {dashes.map((entry) => (
        <View
          key={entry.offset}
          style={{
            position: 'absolute',
            left: vertical ? 0 : entry.offset,
            top: vertical ? entry.offset : 0,
            width: vertical ? thickness : entry.size,
            height: vertical ? entry.size : thickness,
            borderRadius: thickness / 2,
            backgroundColor: color,
          }}
        />
      ))}
    </View>
  );
};

export default CanvasLine;
