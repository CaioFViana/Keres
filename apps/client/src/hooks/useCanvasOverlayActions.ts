import {
  MAX_CANVAS_OVERLAY_POINTS,
  type CanvasOverlayType,
  type SpatialPoint,
} from '@keres/shared';
import {
  canvasOverlayPresetPoints,
  type CanvasOverlayPreset,
} from '@keres/shared/graphs/canvasOverlayGeometry';
import { useCallback, useMemo, useRef, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import {
  isRectDrawTool,
  type AddObjectsAction,
  type OverlayDrawTool,
  type OverlayInteractionMode,
} from '../components/features/graphs/CanvasOverlay/overlayTools';
import { clampCanvasWorldCoordinate } from '../utils/canvasDragBounds';

const MIN_RECT_WORLD = 8;
const PRESET_SIZE = 140;
const PRESET_STAGGER = 16;

interface UseCanvasOverlayActionsOptions<TContent extends { overlays?: CanvasOverlayType[] }> {
  setContent: Dispatch<SetStateAction<TContent>>;
  generateOverlayId: () => string;
  placementCenter: () => SpatialPoint;
  /** Boards add notes through the pill; maps keep their marker button, so this stays unset. */
  onAddNote?: () => void;
}

/**
 * Overlay drawing/editing state shared by the board and map screens: the armed tool, the
 * in-progress vertices, the selection, and every content patch (commit, preset, move,
 * vertex, rect, label/color, delete). Screens stay thin: one hook, one pill, one sheet.
 */
export function useCanvasOverlayActions<TContent extends { overlays?: CanvasOverlayType[] }>({
  setContent,
  generateOverlayId,
  placementCenter,
  onAddNote,
}: UseCanvasOverlayActionsOptions<TContent>) {
  const [drawTool, setDrawTool] = useState<OverlayDrawTool | null>(null);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedOverlayId, setSelectedOverlayId] = useState<string | null>(null);
  const [draftPoints, setDraftPoints] = useState<SpatialPoint[]>([]);
  const placements = useRef(0);

  const patchOverlays = useCallback(
    (patch: (overlays: CanvasOverlayType[]) => CanvasOverlayType[]) => {
      setContent((current) => ({ ...current, overlays: patch(current.overlays ?? []) }));
    },
    [setContent],
  );

  const clearTools = useCallback(() => {
    setDrawTool(null);
    setSelectMode(false);
    setDraftPoints([]);
  }, []);

  const cancelInteraction = useCallback(() => {
    clearTools();
    setSelectedOverlayId(null);
  }, [clearTools]);

  const startDraw = useCallback(
    (tool: OverlayDrawTool) => {
      setSelectedOverlayId(null);
      setSelectMode(false);
      setDraftPoints([]);
      setDrawTool(tool);
    },
    [],
  );

  const cancelDraw = useCallback(() => {
    setDrawTool(null);
    setDraftPoints([]);
  }, []);

  const startSelect = useCallback(() => {
    setDrawTool(null);
    setDraftPoints([]);
    setSelectedOverlayId(null);
    setSelectMode(true);
  }, []);

  const addDraftPoint = useCallback(
    (point: SpatialPoint) => {
      const clamped = {
        x: clampCanvasWorldCoordinate(point.x),
        y: clampCanvasWorldCoordinate(point.y),
      };
      setDraftPoints((current) =>
        current.length >= MAX_CANVAS_OVERLAY_POINTS ? current : [...current, clamped],
      );
    },
    [],
  );

  const finishDraft = useCallback(() => {
    if (drawTool !== 'line' && drawTool !== 'polygon') return;
    if (drawTool === 'line' && draftPoints.length < 2) return;
    if (drawTool === 'polygon' && draftPoints.length < 3) return;
    const overlay: CanvasOverlayType =
      drawTool === 'line'
        ? { id: generateOverlayId(), kind: 'line', points: draftPoints }
        : { id: generateOverlayId(), kind: 'polygon', points: draftPoints };
    patchOverlays((overlays) => [...overlays, overlay]);
    setSelectedOverlayId(overlay.id);
    setDrawTool(null);
    setDraftPoints([]);
  }, [draftPoints, drawTool, generateOverlayId, patchOverlays]);

  const commitRectDraw = useCallback(
    (tool: OverlayDrawTool, start: SpatialPoint, end: SpatialPoint) => {
      if (!isRectDrawTool(tool)) return;
      const x = Math.min(start.x, end.x);
      const y = Math.min(start.y, end.y);
      const width = Math.abs(end.x - start.x);
      const height = Math.abs(end.y - start.y);
      if (width < MIN_RECT_WORLD || height < MIN_RECT_WORLD) return;
      const overlay: CanvasOverlayType =
        tool === 'frame'
          ? { id: generateOverlayId(), kind: 'frame', x, y, width, height }
          : {
              id: generateOverlayId(),
              kind: 'shape',
              shapeType: tool === 'ellipse' ? 'ellipse' : 'rect',
              x,
              y,
              width,
              height,
            };
      patchOverlays((overlays) => [...overlays, overlay]);
      setSelectedOverlayId(overlay.id);
      setDrawTool(null);
    },
    [generateOverlayId, patchOverlays],
  );

  const addPreset = useCallback(
    (preset: CanvasOverlayPreset) => {
      const center = placementCenter();
      const step = (placements.current % 5) * PRESET_STAGGER;
      placements.current += 1;
      const overlay: CanvasOverlayType = {
        id: generateOverlayId(),
        kind: 'polygon',
        points: canvasOverlayPresetPoints(
          preset,
          { x: center.x + step, y: center.y + step },
          PRESET_SIZE,
        ),
      };
      patchOverlays((overlays) => [...overlays, overlay]);
      setSelectedOverlayId(overlay.id);
    },
    [generateOverlayId, patchOverlays, placementCenter],
  );

  const handleObjectsAction = useCallback(
    (action: AddObjectsAction) => {
      if (action === 'note') {
        cancelInteraction();
        onAddNote?.();
        return;
      }
      if (action === 'select') {
        startSelect();
        return;
      }
      if (action.startsWith('draw:')) {
        startDraw(action.slice('draw:'.length) as OverlayDrawTool);
        return;
      }
      addPreset(action.slice('preset:'.length) as CanvasOverlayPreset);
    },
    [addPreset, cancelInteraction, onAddNote, startDraw, startSelect],
  );

  const selectOverlay = useCallback((id: string | null) => {
    // A miss also leaves select mode: tap empty space to cancel the tool.
    setSelectMode(false);
    setSelectedOverlayId(id);
  }, []);

  const updateOverlay = useCallback(
    (id: string, patch: { label?: string | null; color?: string | null }) => {
      patchOverlays((overlays) =>
        overlays.map((overlay) => (overlay.id === id ? { ...overlay, ...patch } : overlay)),
      );
    },
    [patchOverlays],
  );

  const deleteOverlay = useCallback(
    (id: string) => {
      patchOverlays((overlays) => overlays.filter((overlay) => overlay.id !== id));
      setSelectedOverlayId((current) => (current === id ? null : current));
    },
    [patchOverlays],
  );

  const commitMove = useCallback(
    (id: string, dx: number, dy: number) => {
      if (dx === 0 && dy === 0) return;
      patchOverlays((overlays) =>
        overlays.map((overlay) => {
          if (overlay.id !== id) return overlay;
          if (overlay.kind === 'line' || overlay.kind === 'polygon') {
            return {
              ...overlay,
              points: overlay.points.map((point) => ({
                x: clampCanvasWorldCoordinate(point.x + dx),
                y: clampCanvasWorldCoordinate(point.y + dy),
              })),
            };
          }
          return {
            ...overlay,
            x: clampCanvasWorldCoordinate(overlay.x + dx),
            y: clampCanvasWorldCoordinate(overlay.y + dy),
          };
        }),
      );
    },
    [patchOverlays],
  );

  const commitVertex = useCallback(
    (id: string, index: number, point: SpatialPoint) => {
      patchOverlays((overlays) =>
        overlays.map((overlay) => {
          if (overlay.id !== id) return overlay;
          if (overlay.kind !== 'line' && overlay.kind !== 'polygon') return overlay;
          if (index < 0 || index >= overlay.points.length) return overlay;
          return {
            ...overlay,
            points: overlay.points.map((candidate, candidateIndex) =>
              candidateIndex === index
                ? {
                    x: clampCanvasWorldCoordinate(point.x),
                    y: clampCanvasWorldCoordinate(point.y),
                  }
                : candidate,
            ),
          };
        }),
      );
    },
    [patchOverlays],
  );

  const commitRectEdit = useCallback(
    (id: string, rect: { x: number; y: number; width: number; height: number }) => {
      patchOverlays((overlays) =>
        overlays.map((overlay) => {
          if (overlay.id !== id) return overlay;
          if (overlay.kind !== 'frame' && overlay.kind !== 'shape') return overlay;
          return {
            ...overlay,
            x: clampCanvasWorldCoordinate(rect.x),
            y: clampCanvasWorldCoordinate(rect.y),
            width: Math.max(MIN_RECT_WORLD, rect.width),
            height: Math.max(MIN_RECT_WORLD, rect.height),
          };
        }),
      );
    },
    [patchOverlays],
  );

  const interactionMode: OverlayInteractionMode = useMemo(
    () =>
      drawTool ? { kind: 'draw', tool: drawTool } : selectMode ? { kind: 'select' } : null,
    [drawTool, selectMode],
  );
  const draft = useMemo(
    () =>
      (drawTool === 'line' || drawTool === 'polygon') && draftPoints.length > 0
        ? { tool: drawTool, points: draftPoints }
        : null,
    [draftPoints, drawTool],
  );
  const canFinish =
    (drawTool === 'line' && draftPoints.length >= 2) ||
    (drawTool === 'polygon' && draftPoints.length >= 3);

  return {
    drawTool,
    selectMode,
    selectedOverlayId,
    draftPoints,
    draft,
    canFinish,
    interactionMode,
    handleObjectsAction,
    cancelDraw,
    cancelInteraction,
    selectOverlay,
    addDraftPoint,
    finishDraft,
    commitRectDraw,
    updateOverlay,
    deleteOverlay,
    commitMove,
    commitVertex,
    commitRectEdit,
    // Canvas-facing aliases (`OverlayCanvasCallbacks`): screens pass the actions object
    // straight into the canvas props.
    onDrawTap: addDraftPoint,
    onDrawRect: commitRectDraw,
    onSelectOverlay: selectOverlay,
    onCommitMove: commitMove,
    onCommitVertex: commitVertex,
    onCommitRect: commitRectEdit,
  };
}

export type CanvasOverlayActions = ReturnType<typeof useCanvasOverlayActions>;
