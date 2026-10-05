import type { CanvasOverlayType } from '../schemas/CanvasOverlaySchemas';
import {
  generateSketchLocalId,
  MAX_SKETCH_LAYERS,
  type SketchContentType,
  type SketchLayerType,
  type SketchPageType,
} from '../schemas/SketchSchemas';
import { decodeSketchItems, encodeSketchItems } from './sketchCodec';
import { compactSketchItems } from './sketchGeometry';
import {
  MAX_SKETCH_TOTAL_DATA_LENGTH,
  type SketchFill,
  type SketchItem,
  type SketchStroke,
} from './sketchTypes';

/**
 * The editable form of a sketch: layers hold decoded items instead of the encoded string.
 * Every operation here is immutable and keeps unchanged layers/items by reference, so the
 * editor's undo history can hold many snapshots of a big drawing at almost no cost, and
 * `doc !== savedDoc` is an O(1) dirty check.
 */
export interface SketchLayerDoc {
  id: string;
  name: string;
  visible: boolean;
  opacity: number;
  locked: boolean;
  items: SketchItem[];
}

export interface SketchDocument {
  page: SketchPageType;
  layers: SketchLayerDoc[];
  overlays: CanvasOverlayType[];
}

export function decodeSketchDocument(content: SketchContentType): SketchDocument {
  return {
    page: content.page,
    layers: content.layers.map((layer) => ({
      id: layer.id,
      name: layer.name,
      visible: layer.visible,
      opacity: layer.opacity,
      locked: layer.locked,
      items: decodeSketchItems(layer.data),
    })),
    overlays: content.overlays,
  };
}

/** What gets stored: items compacted and encoded layer by layer. */
export function encodeSketchDocument(doc: SketchDocument): SketchContentType {
  return {
    page: doc.page,
    layers: doc.layers.map(
      (layer): SketchLayerType => ({
        id: layer.id,
        name: layer.name,
        visible: layer.visible,
        opacity: layer.opacity,
        locked: layer.locked,
        data: encodeSketchItems(compactSketchItems(layer.items)),
      }),
    ),
    overlays: doc.overlays,
  };
}

// ---------------------------------------------------------------- size meter

/**
 * Rough encoded size, without deflating: the editor warns as a sketch nears the budget. Errs high
 * on purpose (hand-drawn noise compresses to roughly 1.6 stored characters per point; this counts
 * 2) so the warning arrives before the real limit does.
 */
export function estimateSketchDataLength(doc: SketchDocument): number {
  let characters = 0;
  for (const layer of doc.layers) {
    for (const item of layer.items) {
      if (item.kind === 'stroke') characters += 14 + item.points.length * 1.0;
      else characters += 14 + item.rings.reduce((sum, ring) => sum + 4 + ring.length * 1.0, 0);
    }
  }
  return Math.round(characters);
}

/** 0 to 1+ share of the sketch budget the drawing is estimated to use. */
export function sketchBudgetUsage(doc: SketchDocument): number {
  return estimateSketchDataLength(doc) / MAX_SKETCH_TOTAL_DATA_LENGTH;
}

// ---------------------------------------------------------------- layer helpers

export function findLayer(doc: SketchDocument, layerId: string): SketchLayerDoc | undefined {
  return doc.layers.find((layer) => layer.id === layerId);
}

function mapLayer(
  doc: SketchDocument,
  layerId: string,
  update: (layer: SketchLayerDoc) => SketchLayerDoc,
): SketchDocument {
  let touched = false;
  const layers = doc.layers.map((layer) => {
    if (layer.id !== layerId) return layer;
    const next = update(layer);
    if (next !== layer) touched = true;
    return next;
  });
  return touched ? { ...doc, layers } : doc;
}

export function patchLayer(
  doc: SketchDocument,
  layerId: string,
  patch: Partial<Pick<SketchLayerDoc, 'name' | 'visible' | 'opacity' | 'locked'>>,
): SketchDocument {
  return mapLayer(doc, layerId, (layer) => ({ ...layer, ...patch }));
}

export function setLayerItems(
  doc: SketchDocument,
  layerId: string,
  items: SketchItem[],
): SketchDocument {
  return mapLayer(doc, layerId, (layer) => (layer.items === items ? layer : { ...layer, items }));
}

/** Strokes land on top of the layer. */
export function appendStroke(
  doc: SketchDocument,
  layerId: string,
  stroke: SketchStroke,
): SketchDocument {
  return mapLayer(doc, layerId, (layer) => ({ ...layer, items: [...layer.items, stroke] }));
}

/**
 * Fills sit in a block at the bottom of the layer, above older fills but under every stroke:
 * the outline always paints over the fill's edge, and a refill replaces the color on top of the
 * previous one.
 */
export function insertFill(doc: SketchDocument, layerId: string, fill: SketchFill): SketchDocument {
  return mapLayer(doc, layerId, (layer) => {
    let at = 0;
    for (let index = layer.items.length - 1; index >= 0; index -= 1) {
      if (layer.items[index].kind === 'fill') {
        at = index + 1;
        break;
      }
    }
    const items = layer.items.slice();
    items.splice(at, 0, fill);
    return { ...layer, items };
  });
}

export function allLayerIds(doc: SketchDocument): Set<string> {
  return new Set([
    ...doc.layers.map((layer) => layer.id),
    ...doc.overlays.map((overlay) => overlay.id),
  ]);
}

export function addLayer(doc: SketchDocument, name: string, aboveLayerId?: string): SketchDocument {
  if (doc.layers.length >= MAX_SKETCH_LAYERS) return doc;
  const layer: SketchLayerDoc = {
    id: generateSketchLocalId(allLayerIds(doc)),
    name,
    visible: true,
    opacity: 1,
    locked: false,
    items: [],
  };
  const index = aboveLayerId
    ? doc.layers.findIndex((candidate) => candidate.id === aboveLayerId)
    : -1;
  const layers = doc.layers.slice();
  layers.splice(index >= 0 ? index + 1 : layers.length, 0, layer);
  return { ...doc, layers };
}

/** The last layer cannot be removed: a sketch always has somewhere to draw. */
export function removeLayer(doc: SketchDocument, layerId: string): SketchDocument {
  if (doc.layers.length <= 1) return doc;
  return { ...doc, layers: doc.layers.filter((layer) => layer.id !== layerId) };
}

/** Index 0 is the bottom layer; `delta` +1 moves it up. */
export function moveLayer(doc: SketchDocument, layerId: string, delta: number): SketchDocument {
  const from = doc.layers.findIndex((layer) => layer.id === layerId);
  const to = Math.min(doc.layers.length - 1, Math.max(0, from + delta));
  if (from < 0 || from === to) return doc;
  const layers = doc.layers.slice();
  const [moved] = layers.splice(from, 1);
  layers.splice(to, 0, moved);
  return { ...doc, layers };
}

export function duplicateLayer(doc: SketchDocument, layerId: string, name: string): SketchDocument {
  if (doc.layers.length >= MAX_SKETCH_LAYERS) return doc;
  const index = doc.layers.findIndex((layer) => layer.id === layerId);
  if (index < 0) return doc;
  const source = doc.layers[index];
  const copy: SketchLayerDoc = {
    ...source,
    id: generateSketchLocalId(allLayerIds(doc)),
    name,
    locked: false,
  };
  const layers = doc.layers.slice();
  layers.splice(index + 1, 0, copy);
  return { ...doc, layers };
}

/** Folds a layer's items into the layer beneath it (the upper layer's opacity is lost). */
export function mergeLayerDown(doc: SketchDocument, layerId: string): SketchDocument {
  const index = doc.layers.findIndex((layer) => layer.id === layerId);
  if (index <= 0) return doc;
  const upper = doc.layers[index];
  const lower = doc.layers[index - 1];
  const layers = doc.layers.slice();
  layers.splice(index - 1, 2, { ...lower, items: [...lower.items, ...upper.items] });
  return { ...doc, layers };
}

export function clearLayer(doc: SketchDocument, layerId: string): SketchDocument {
  return mapLayer(doc, layerId, (layer) =>
    layer.items.length === 0 ? layer : { ...layer, items: [] },
  );
}

export function moveItemsToLayer(
  doc: SketchDocument,
  fromLayerId: string,
  toLayerId: string,
  items: ReadonlySet<SketchItem>,
): SketchDocument {
  if (fromLayerId === toLayerId || items.size === 0) return doc;
  const source = findLayer(doc, fromLayerId);
  if (!source) return doc;
  const moved = source.items.filter((item) => items.has(item));
  const kept = source.items.filter((item) => !items.has(item));
  let next = setLayerItems(doc, fromLayerId, kept);
  next = mapLayer(next, toLayerId, (layer) => ({ ...layer, items: [...layer.items, ...moved] }));
  return next;
}

/** Brings the picked items to the top, or sends them to the bottom, of their layer. */
export function reorderItems(
  items: readonly SketchItem[],
  picked: ReadonlySet<SketchItem>,
  direction: 'front' | 'back',
): SketchItem[] {
  const chosen = items.filter((item) => picked.has(item));
  const rest = items.filter((item) => !picked.has(item));
  return direction === 'front' ? [...rest, ...chosen] : [...chosen, ...rest];
}

export function documentIsEmpty(doc: SketchDocument): boolean {
  return doc.overlays.length === 0 && doc.layers.every((layer) => layer.items.length === 0);
}
