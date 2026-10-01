import { Canvas, Path } from '@shopify/react-native-skia';
import React from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import type { GuideRect } from '../../../../guides/types';
import { useCanvasKitReady } from '../../../features/graphs/SkiaEdgeCanvas/useCanvasKitReady';

/** Corner radius shared by the hole and its border, so no square corner peeks out. */
export const SPOTLIGHT_RADIUS = 8;
const SPOTLIGHT_BORDER_WIDTH = 2;
const DIM_COLOR = 'rgba(0, 0, 0, 0.6)';

interface GuideSpotlightProps {
  /** The padded hole in window coordinates, as the host computed it. */
  rect: GuideRect;
  borderColor: string;
  testID?: string;
}

const format = (value: number): string => (Number.isInteger(value) ? `${value}` : value.toFixed(2));

/**
 * An SVG rounded-rect subpath. The radius clamps to half the smallest side, so tiny
 * anchors degrade to a pill instead of an invalid path.
 */
export function roundedRectSvg(rect: GuideRect, radius: number): string {
  const { x, y, width, height } = rect;
  const r = Math.max(0, Math.min(radius, width / 2, height / 2));
  const right = x + width;
  const bottom = y + height;
  return (
    `M${format(x + r)} ${format(y)}` +
    `H${format(right - r)}Q${format(right)} ${format(y)} ${format(right)} ${format(y + r)}` +
    `V${format(bottom - r)}Q${format(right)} ${format(bottom)} ${format(right - r)} ${format(bottom)}` +
    `H${format(x + r)}Q${format(x)} ${format(bottom)} ${format(x)} ${format(bottom - r)}` +
    `V${format(y + r)}Q${format(x)} ${format(y)} ${format(x + r)} ${format(y)}Z`
  );
}

/** Full-window rect with the rounded hole punched out (paired with `evenOdd`). */
export function spotlightDimSvg(
  windowWidth: number,
  windowHeight: number,
  rect: GuideRect,
  radius: number,
): string {
  return `M0 0H${format(windowWidth)}V${format(windowHeight)}H0Z ${roundedRectSvg(rect, radius)}`;
}

/**
 * The tour spotlight: a dimmed window with a rounded hole over the target and a matching
 * border. One Skia canvas draws both from the same geometry, so the hole and the border
 * can never disagree the way stacked rectangular views did. Before CanvasKit is ready
 * (web boot), square legacy views keep the tour usable.
 */
const GuideSpotlight: React.FC<GuideSpotlightProps> = ({
  rect,
  borderColor,
  testID = 'guide-spotlight',
}) => {
  const ready = useCanvasKitReady();
  const { width, height } = useWindowDimensions();

  if (!ready) {
    const square = { left: rect.x, top: rect.y, width: rect.width, height: rect.height };
    return (
      <>
        <View
          pointerEvents="none"
          style={[styles.dim, { top: 0, left: 0, right: 0, height: rect.y }]}
        />
        <View
          pointerEvents="none"
          style={[styles.dim, { top: rect.y + rect.height, left: 0, right: 0, bottom: 0 }]}
        />
        <View
          pointerEvents="none"
          style={[styles.dim, { top: rect.y, left: 0, width: rect.x, height: rect.height }]}
        />
        <View
          pointerEvents="none"
          style={[
            styles.dim,
            { top: rect.y, left: rect.x + rect.width, right: 0, height: rect.height },
          ]}
        />
        <View
          pointerEvents="none"
          testID={testID}
          style={[styles.squareHighlight, square, { borderColor }]}
        />
      </>
    );
  }

  const half = SPOTLIGHT_BORDER_WIDTH / 2;
  const borderPath = roundedRectSvg(
    {
      x: rect.x + half,
      y: rect.y + half,
      width: rect.width - half * 2,
      height: rect.height - half * 2,
    },
    SPOTLIGHT_RADIUS - half,
  );

  return (
    <Canvas style={StyleSheet.absoluteFill} pointerEvents="none" testID={testID}>
      <Path
        path={spotlightDimSvg(width, height, rect, SPOTLIGHT_RADIUS)}
        fillType="evenOdd"
        color={DIM_COLOR}
      />
      <Path
        path={borderPath}
        style="stroke"
        strokeWidth={SPOTLIGHT_BORDER_WIDTH}
        color={borderColor}
      />
    </Canvas>
  );
};

const styles = StyleSheet.create({
  dim: {
    position: 'absolute',
    backgroundColor: DIM_COLOR,
  },
  squareHighlight: {
    position: 'absolute',
    borderWidth: SPOTLIGHT_BORDER_WIDTH,
  },
});

export default GuideSpotlight;
