import type { ForwardedRef } from 'react';
import { useMemo } from 'react';
import { spatialRectIntersects } from '@keres/shared';
import type { CanvasViewportBounds, CanvasViewportOptions } from './canvasViewportTypes';
import type { CanvasViewportHandle } from './useCanvasViewport';
import { useCanvasViewport } from './useCanvasViewport';

interface PositionedNode {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * The pan/zoom viewport every graph canvas shares, plus the nodes inside the visible window: the
 * rest are not mounted, so a large map stays cheap to draw.
 */
export function useGraphCanvasViewport<TNode extends PositionedNode>(
  ref: ForwardedRef<CanvasViewportHandle>,
  layout: CanvasViewportBounds & { nodes: TNode[] },
  /** A tap on empty canvas, in drawing coordinates (a tap on a node never gets here). */
  onTap?: CanvasViewportOptions['onTap'],
) {
  const viewport = useCanvasViewport(ref, layout, { clampMode: 'free', onTap });
  const { renderWindow } = viewport;

  const visibleNodes = useMemo(
    () =>
      layout.nodes.filter((node) =>
        spatialRectIntersects(
          { x: node.x, y: node.y, width: node.width, height: node.height },
          renderWindow,
        ),
      ),
    [layout.nodes, renderWindow],
  );

  return { ...viewport, visibleNodes };
}
