import { describe, expect, it } from 'vitest';
import { emptySketchContent, validateSketchContent } from '../../schemas/SketchSchemas';
import {
  addLayer,
  appendStroke,
  clearLayer,
  decodeSketchDocument,
  duplicateLayer,
  encodeSketchDocument,
  estimateSketchDataLength,
  insertFill,
  mergeLayerDown,
  moveItemsToLayer,
  moveLayer,
  patchLayer,
  removeLayer,
  reorderItems,
  setLayerItems,
} from '../../sketch/sketchDocument';
import type { SketchFill, SketchStroke } from '../../sketch/sketchTypes';

function stroke(x: number): SketchStroke {
  return {
    kind: 'stroke',
    brush: 'pen',
    color: '#000000',
    alpha: 1,
    size: 3,
    points: [x, 0, x + 10, 10],
  };
}
const fillItem = (color: string): SketchFill => ({
  kind: 'fill',
  color,
  alpha: 1,
  rings: [[0, 0, 10, 0, 10, 10, 0, 10]],
});

function blank() {
  return decodeSketchDocument(emptySketchContent('AAAAAAAA', 'Layer 1'));
}

describe('sketch document', () => {
  it('round-trips through the stored content and stays valid', () => {
    let doc = blank();
    doc = appendStroke(doc, 'AAAAAAAA', stroke(1));
    doc = insertFill(doc, 'AAAAAAAA', fillItem('#ff0000'));
    const content = encodeSketchDocument(doc);
    expect(() => validateSketchContent(content)).not.toThrow();
    const back = decodeSketchDocument(content);
    expect(back.layers[0].items).toHaveLength(2);
  });

  it('keeps unchanged layers by reference', () => {
    let doc = addLayer(blank(), 'Layer 2');
    const first = doc.layers[0];
    doc = appendStroke(doc, doc.layers[1].id, stroke(1));
    expect(doc.layers[0]).toBe(first);
  });

  it('is a no-op (same reference) when nothing changes', () => {
    const doc = blank();
    expect(clearLayer(doc, 'AAAAAAAA')).toBe(doc);
    expect(patchLayer(doc, 'MISSING0', { name: 'x' })).toBe(doc);
    expect(removeLayer(doc, 'AAAAAAAA')).toBe(doc);
    expect(moveLayer(doc, 'AAAAAAAA', 1)).toBe(doc);
    const items = doc.layers[0].items;
    expect(setLayerItems(doc, 'AAAAAAAA', items)).toBe(doc);
  });

  it('puts fills under strokes and refills above older fills', () => {
    let doc = blank();
    doc = appendStroke(doc, 'AAAAAAAA', stroke(1));
    doc = insertFill(doc, 'AAAAAAAA', fillItem('#111111'));
    doc = insertFill(doc, 'AAAAAAAA', fillItem('#222222'));
    const kinds = doc.layers[0].items.map((item) => (item.kind === 'fill' ? item.color : 'stroke'));
    expect(kinds).toEqual(['#111111', '#222222', 'stroke']);
  });

  it('adds layers above a given one and respects the layer ceiling', () => {
    let doc = blank();
    doc = addLayer(doc, 'Top');
    doc = addLayer(doc, 'Middle', 'AAAAAAAA');
    expect(doc.layers.map((layer) => layer.name)).toEqual(['Layer 1', 'Middle', 'Top']);
    for (let index = 0; index < 40; index += 1) doc = addLayer(doc, `L${index}`);
    expect(doc.layers.length).toBe(24);
  });

  it('moves, duplicates and merges layers', () => {
    let doc = blank();
    doc = appendStroke(doc, 'AAAAAAAA', stroke(1));
    doc = addLayer(doc, 'Upper');
    const upperId = doc.layers[1].id;
    doc = appendStroke(doc, upperId, stroke(50));
    doc = moveLayer(doc, upperId, -1);
    expect(doc.layers[0].id).toBe(upperId);
    doc = moveLayer(doc, upperId, 1);
    const copied = duplicateLayer(doc, upperId, 'Copy');
    expect(copied.layers).toHaveLength(3);
    expect(copied.layers[2].items).toEqual(doc.layers[1].items);
    expect(copied.layers[2].id).not.toBe(upperId);
    const merged = mergeLayerDown(doc, upperId);
    expect(merged.layers).toHaveLength(1);
    expect(merged.layers[0].items).toHaveLength(2);
  });

  it('moves selected items to another layer and reorders them', () => {
    let doc = addLayer(blank(), 'Two');
    const [a, b] = [stroke(1), stroke(2)];
    doc = setLayerItems(doc, 'AAAAAAAA', [a, b]);
    const target = doc.layers[1].id;
    const moved = moveItemsToLayer(doc, 'AAAAAAAA', target, new Set([a]));
    expect(moved.layers[0].items).toEqual([b]);
    expect(moved.layers[1].items).toEqual([a]);
    expect(reorderItems([a, b], new Set([a]), 'front')).toEqual([b, a]);
    expect(reorderItems([a, b], new Set([b]), 'back')).toEqual([b, a]);
  });

  it('estimates size within a reasonable factor of the real encoding', () => {
    let doc = blank();
    for (let index = 0; index < 400; index += 1) {
      const points: number[] = [];
      for (let step = 0; step < 50; step += 1) {
        points.push(
          100 + step * 2.7 + index * 0.1,
          300 + Math.sin(step / 4 + index) * 30 + (index % 7) * 9,
        );
      }
      doc = appendStroke(doc, 'AAAAAAAA', { ...stroke(0), points });
    }
    const real = encodeSketchDocument(doc).layers[0].data.length;
    const estimate = estimateSketchDataLength(doc);
    expect(estimate).toBeGreaterThan(real * 0.5);
    expect(estimate).toBeLessThan(real * 5);
  });
});
