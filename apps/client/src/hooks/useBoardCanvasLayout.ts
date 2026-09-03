import type { BoardContentType } from '@keres/shared';
import { useCallback } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { clampCanvasWorldCoordinate } from '../utils/canvasDragBounds';

/** Mutations for board card placement, sizing and stacking, kept outside the screen container. */
export function useBoardCanvasLayout(setContent: Dispatch<SetStateAction<BoardContentType>>) {
  const handleMoveNode = useCallback(
    (id: string, x: number, y: number) => {
      const position = { x: clampCanvasWorldCoordinate(x), y: clampCanvasWorldCoordinate(y) };
      setContent((current) => ({
        ...current,
        nodes: current.nodes.map((node) => (node.id === id ? { ...node, ...position } : node)),
      }));
    },
    [setContent],
  );

  const handleResizeNode = useCallback(
    (id: string, width: number, height: number) => {
      setContent((current) => ({
        ...current,
        nodes: current.nodes.map((node) =>
          node.id === id
            ? {
                ...node,
                width: Math.min(720, Math.max(148, width)),
                height: Math.min(720, Math.max(86, height)),
              }
            : node,
        ),
      }));
    },
    [setContent],
  );

  const moveNodeLayer = useCallback(
    (id: string, direction: 'front' | 'back') => {
      setContent((current) => {
        const levels = current.nodes.map((node) => node.zIndex ?? 0);
        const target =
          direction === 'front' ? Math.max(0, ...levels) + 1 : Math.min(0, ...levels) - 1;
        return {
          ...current,
          nodes: current.nodes.map((node) => (node.id === id ? { ...node, zIndex: target } : node)),
        };
      });
    },
    [setContent],
  );

  return { handleMoveNode, handleResizeNode, moveNodeLayer };
}
