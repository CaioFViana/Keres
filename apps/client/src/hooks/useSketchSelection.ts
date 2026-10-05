import {
  findLayer,
  flipSelectionMatrix,
  hitTestSketchItems,
  moveItemsToLayer,
  reorderItems,
  type SketchDocument,
  type SketchItem,
  type SketchMatrix,
  type SketchPoint,
  selectItemsByLasso,
  setLayerItems,
  sketchItemsBounds,
  transformSelectedItems,
  transformSketchItem,
  translateMatrix,
} from '@keres/shared';
import { hitTestCanvasOverlay } from '@keres/shared/graphs/canvasOverlayGeometry';
import {
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
  useCallback,
  useMemo,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import type { SketchSelectionActions } from '../components/features/sketches/SketchOptionsBar';
import { useNotificationStore } from '../state/notificationStore';
import { useSketchToolStore } from '../state/sketchToolStore';

const DUPLICATE_OFFSET = 18;

interface Selection {
  layerId: string;
  items: Set<SketchItem>;
}

interface UseSketchSelectionOptions {
  doc: SketchDocument;
  /** The document as drawn right now (an erase in progress included). */
  displayDoc: SketchDocument;
  docRef: MutableRefObject<SketchDocument>;
  setDoc: Dispatch<SetStateAction<SketchDocument>>;
  activeLayerId: string;
  setActiveLayer: (layerId: string) => void;
  /** Taps on an object (text, balloon, stamp) select it through the overlay actions. */
  selectOverlay: (id: string) => void;
}

/**
 * Picking drawing items and acting on them: lasso (whole or cut), tap-to-pick, live transform,
 * and the selection bar (delete, duplicate, flip, reorder, move to another layer). The selection is
 * a set of item references; whatever undo, redo or an erase removed simply drops out of it.
 */
export function useSketchSelection({
  doc,
  displayDoc,
  docRef,
  setDoc,
  activeLayerId,
  setActiveLayer,
  selectOverlay,
}: UseSketchSelectionOptions) {
  const { t } = useTranslation();
  const { showNotification } = useNotificationStore();
  const [selection, setSelection] = useState<Selection | null>(null);
  const [transformMatrix, setTransformMatrix] = useState<SketchMatrix | null>(null);

  const clearSelection = useCallback(() => {
    setSelection(null);
    setTransformMatrix(null);
  }, []);

  const liveSelection = useMemo(() => {
    if (!selection) return null;
    const layer = findLayer(displayDoc, selection.layerId);
    if (!layer) return null;
    const alive = layer.items.filter((item) => selection.items.has(item));
    if (alive.length === 0) return null;
    const bounds = sketchItemsBounds(alive);
    return bounds ? { layerId: selection.layerId, items: new Set(alive), bounds } : null;
  }, [displayDoc, selection]);

  const handleLassoCommit = useCallback(
    (polygon: number[]) => {
      const layer = findLayer(docRef.current, activeLayerId);
      if (!layer || layer.locked || !layer.visible) {
        showNotification(t('sketch_layer_locked_notice'), 'warning');
        return;
      }
      const result = selectItemsByLasso(
        layer.items,
        polygon,
        useSketchToolStore.getState().lassoMode,
      );
      if (result.selected.length === 0) {
        setSelection(null);
        return;
      }
      if (result.items !== layer.items)
        setDoc((current) => setLayerItems(current, layer.id, result.items));
      setSelection({ layerId: layer.id, items: new Set(result.selected) });
    },
    [activeLayerId, docRef, setDoc, showNotification, t],
  );

  const handleSelectTap = useCallback(
    (point: SketchPoint, tolerance: number) => {
      const current = docRef.current;
      const overlay = hitTestCanvasOverlay(point, current.overlays, tolerance);
      if (overlay) {
        setSelection(null);
        selectOverlay(overlay.id);
        return;
      }
      const layer = findLayer(current, activeLayerId);
      if (!layer || layer.locked || !layer.visible) {
        setSelection(null);
        return;
      }
      const index = hitTestSketchItems(layer.items, point.x, point.y, tolerance);
      setSelection(index >= 0 ? { layerId: layer.id, items: new Set([layer.items[index]]) } : null);
    },
    [activeLayerId, docRef, selectOverlay],
  );

  const applyMatrix = useCallback(
    (matrix: SketchMatrix) => {
      if (!liveSelection) return;
      const layer = findLayer(docRef.current, liveSelection.layerId);
      if (!layer) return;
      const result = transformSelectedItems(layer.items, liveSelection.items, matrix);
      setDoc((current) => setLayerItems(current, liveSelection.layerId, result.items));
      setSelection({ layerId: liveSelection.layerId, items: new Set(result.selected) });
      setTransformMatrix(null);
    },
    [docRef, liveSelection, setDoc],
  );

  const selectionActions = useMemo((): SketchSelectionActions | null => {
    if (!liveSelection) return null;
    const index = doc.layers.findIndex((layer) => layer.id === liveSelection.layerId);
    if (index < 0) return null;
    const itemsOf = (current: SketchDocument) =>
      findLayer(current, liveSelection.layerId)?.items ?? [];
    return {
      count: liveSelection.items.size,
      canMoveUp: index < doc.layers.length - 1,
      canMoveDown: index > 0,
      onDone: () => setSelection(null),
      onDelete: () => {
        setDoc((current) =>
          setLayerItems(
            current,
            liveSelection.layerId,
            itemsOf(current).filter((item) => !liveSelection.items.has(item)),
          ),
        );
        setSelection(null);
      },
      onDuplicate: () => {
        const copies = [...liveSelection.items].map((item) =>
          transformSketchItem(item, translateMatrix(DUPLICATE_OFFSET, DUPLICATE_OFFSET)),
        );
        setDoc((current) =>
          setLayerItems(current, liveSelection.layerId, [...itemsOf(current), ...copies]),
        );
        setSelection({ layerId: liveSelection.layerId, items: new Set(copies) });
      },
      onFlip: (axis) => applyMatrix(flipSelectionMatrix(axis, liveSelection.bounds)),
      onReorder: (direction) =>
        setDoc((current) =>
          setLayerItems(
            current,
            liveSelection.layerId,
            reorderItems(itemsOf(current), liveSelection.items, direction),
          ),
        ),
      onMoveToLayer: (direction) => {
        const target = doc.layers[index + (direction === 'up' ? 1 : -1)];
        if (!target) return;
        setDoc((current) =>
          moveItemsToLayer(current, liveSelection.layerId, target.id, liveSelection.items),
        );
        setActiveLayer(target.id);
        setSelection({ layerId: target.id, items: liveSelection.items });
      },
    };
  }, [applyMatrix, doc.layers, liveSelection, setActiveLayer, setDoc]);

  return {
    selection: liveSelection,
    transformMatrix,
    setTransformMatrix,
    clearSelection,
    handleLassoCommit,
    handleSelectTap,
    applyMatrix,
    selectionActions,
  };
}
