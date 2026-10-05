import {
  appendStroke,
  eraseFillsAlongPath,
  eraseStrokesAlongPath,
  findLayer,
  floodFillMask,
  insertFill,
  MAX_SKETCH_ITEMS_PER_LAYER,
  maskToFillRings,
  quantizeSketchAlpha,
  quantizeSketchValue,
  type SketchDocument,
  type SketchFill,
  type SketchItem,
  type SketchPoint,
  type SketchStroke,
  setLayerItems,
  simplifyFlatPoints,
  sketchBudgetUsage,
} from '@keres/shared';
import {
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
  useCallback,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { rasterizeSketch, sampleRasterColor } from '../components/features/sketches/sketchRaster';
import { useNotificationStore } from '../state/notificationStore';
import { useSketchToolStore } from '../state/sketchToolStore';

/** RDP tolerance for a finished stroke, in world units: below what the eye resolves on a page. */
const STROKE_SIMPLIFY = 0.3;
const BUDGET_WARN = 0.8;

function pointOnPage(doc: SketchDocument, point: SketchPoint): boolean {
  return point.x >= 0 && point.y >= 0 && point.x < doc.page.width && point.y < doc.page.height;
}

interface UseSketchDrawingOptions {
  docRef: MutableRefObject<SketchDocument>;
  setDoc: Dispatch<SetStateAction<SketchDocument>>;
  /** The layer new work lands on (already resolved against the document). */
  activeLayerId: string;
  /** Paper color the fill and eyedropper read under the drawing. */
  paperColor: string;
}

/** The eraser's path so far, for the live clear drawn over the layer's fills. */
export interface ErasePreview {
  layerId: string;
  /** Flat centerline; the same array grows during the gesture (`version` tells renders apart). */
  path: number[];
  radius: number;
  version: number;
}

interface EraseDraft {
  layerId: string;
  items: SketchItem[];
}

/**
 * What the drawing tools do to the document: commit a stroke, erase along a drag (one history step
 * per gesture, shown live through `eraseView`), bucket fill, and pick a color. Every action first
 * asks whether the layer may take it (hidden, locked, full, over budget) and tells the user why not.
 */
export function useSketchDrawing({
  docRef,
  setDoc,
  activeLayerId,
  paperColor,
}: UseSketchDrawingOptions) {
  const { t } = useTranslation();
  const { showNotification } = useNotificationStore();
  const [eraseView, setEraseView] = useState<EraseDraft | null>(null);
  const eraseDraft = useRef<EraseDraft | null>(null);
  const erasePath = useRef<number[]>([]);
  const eraseSteps = useRef(0);
  const [erasePreview, setErasePreviewState] = useState<ErasePreview | null>(null);
  const erasePreviewRef = useRef<ErasePreview | null>(null);
  const setErasePreview = useCallback((next: ErasePreview | null) => {
    erasePreviewRef.current = next;
    setErasePreviewState(next);
  }, []);
  const budgetWarned = useRef(false);

  /**
   * The layer a gesture may draw on, or null (with a notice) when it may not. `quiet` is for the
   * later events of a gesture already allowed at its start: no notices and no budget scan per move.
   */
  const ensureDrawable = useCallback(
    (quiet = false): string | null => {
      const current = docRef.current;
      const layer = findLayer(current, activeLayerId);
      if (quiet) return layer && layer.visible && !layer.locked ? activeLayerId : null;
      if (!layer || !layer.visible || layer.locked) {
        showNotification(
          t(layer && !layer.visible ? 'sketch_layer_hidden_notice' : 'sketch_layer_locked_notice'),
          'warning',
        );
        return null;
      }
      if (layer.items.length >= MAX_SKETCH_ITEMS_PER_LAYER) {
        showNotification(t('sketch_layer_full'), 'warning');
        return null;
      }
      const usage = sketchBudgetUsage(current);
      if (usage >= 1) {
        showNotification(t('sketch_budget_full'), 'error');
        return null;
      }
      if (usage >= BUDGET_WARN && !budgetWarned.current) {
        budgetWarned.current = true;
        showNotification(t('sketch_budget_warning'), 'warning');
      }
      return activeLayerId;
    },
    [activeLayerId, docRef, showNotification, t],
  );

  const handleStrokeCommit = useCallback(
    (points: number[]) => {
      const layerId = ensureDrawable();
      if (!layerId || points.length < 2) return;
      const store = useSketchToolStore.getState();
      const stroke: SketchStroke = {
        kind: 'stroke',
        brush: store.brush,
        color: store.color,
        alpha: quantizeSketchAlpha(store.alphaByBrush[store.brush]),
        size: quantizeSketchValue(store.sizeByBrush[store.brush]),
        points: points.length > 4 ? simplifyFlatPoints(points, STROKE_SIMPLIFY) : points,
      };
      setDoc((current) => appendStroke(current, layerId, stroke));
    },
    [ensureDrawable, setDoc],
  );

  const handleErase = useCallback(
    (path: number[], radius: number) => {
      const layerId = ensureDrawable(path.length > 2);
      if (!layerId) return;
      const base = eraseDraft.current?.items ?? findLayer(docRef.current, layerId)?.items;
      if (!base) return;
      // The whole centerline of the gesture, kept for the fills: they are cut once, at the end.
      if (path.length === 2) erasePath.current = [path[0], path[1]];
      else erasePath.current.push(path[path.length - 2], path[path.length - 1]);
      eraseSteps.current += 1;
      setErasePreview({
        layerId,
        path: erasePath.current,
        radius,
        version: eraseSteps.current,
      });
      const result = eraseStrokesAlongPath(base, path, radius);
      if (!result.changed) return;
      eraseDraft.current = { layerId, items: result.items };
      setEraseView(eraseDraft.current);
    },
    [docRef, ensureDrawable, setErasePreview],
  );

  const handleEraseEnd = useCallback(() => {
    const draft = eraseDraft.current;
    const preview = erasePreviewRef.current;
    eraseDraft.current = null;
    erasePreviewRef.current = null;
    setEraseView(null);
    setErasePreview(null);
    const path = erasePath.current;
    erasePath.current = [];
    if (!preview) {
      if (draft) setDoc((current) => setLayerItems(current, draft.layerId, draft.items));
      return;
    }
    // Strokes were already cut live; the fills the path crossed are cut now, in one pass.
    const layerId = preview.layerId;
    const base = draft?.items ?? findLayer(docRef.current, layerId)?.items;
    if (!base) return;
    const fills = eraseFillsAlongPath(base, path, preview.radius);
    const items = fills.changed ? fills.items : base;
    if (draft || fills.changed) setDoc((current) => setLayerItems(current, layerId, items));
  }, [docRef, setDoc, setErasePreview]);

  const handleFillTap = useCallback(
    (point: SketchPoint) => {
      // A tap off the page has nothing to fill: skip the rasterizing altogether.
      if (!pointOnPage(docRef.current, point)) return;
      const layerId = ensureDrawable();
      if (!layerId) return;
      const store = useSketchToolStore.getState();
      const raster = rasterizeSketch(docRef.current, {
        layerId,
        sampleAll: store.fillSampleAll,
        paperColor,
      });
      if (!raster) {
        showNotification(t('sketch_fill_failed'), 'error');
        return;
      }
      const mask = floodFillMask(
        raster,
        point.x * raster.scale,
        point.y * raster.scale,
        store.fillTolerance,
        Math.round(store.fillGap * raster.scale),
      );
      if (!mask) return;
      // A region that reaches the page edge on a page with drawing in it is almost always a leak.
      if (mask.touchesEdge && docRef.current.layers.some((layer) => layer.items.length > 0)) {
        showNotification(t('sketch_fill_leak_hint'), 'info');
      }
      const rings = maskToFillRings(mask, {
        scale: raster.scale,
        originX: 0,
        originY: 0,
        // Grow under the outline so no hairline of paper survives between fill and line.
        dilate: Math.max(1, Math.round(raster.scale * 1.5)),
        epsilon: 0.9,
      });
      if (rings.length === 0) return;
      const fill: SketchFill = { kind: 'fill', color: store.color, alpha: 1, rings };
      setDoc((current) => insertFill(current, layerId, fill));
    },
    [docRef, ensureDrawable, paperColor, setDoc, showNotification, t],
  );

  const handlePick = useCallback(
    (point: SketchPoint) => {
      if (!pointOnPage(docRef.current, point)) return;
      const raster = rasterizeSketch(docRef.current, {
        layerId: activeLayerId,
        sampleAll: true,
        paperColor,
      });
      const picked = raster ? sampleRasterColor(raster, point.x, point.y) : null;
      if (!picked) return;
      const store = useSketchToolStore.getState();
      store.setColor(picked);
      store.setTool('brush');
    },
    [activeLayerId, docRef, paperColor],
  );

  return {
    /** The layer's items with the erase in progress applied; null while nothing is being erased. */
    eraseView,
    erasePreview,
    handleStrokeCommit,
    handleErase,
    handleEraseEnd,
    handleFillTap,
    handlePick,
  };
}
