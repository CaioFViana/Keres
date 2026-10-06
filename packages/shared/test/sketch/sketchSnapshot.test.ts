import { describe, expect, it } from 'vitest';
import { emptySketchContent } from '../../schemas/SketchSchemas';
import {
  appendStroke,
  decodeSketchDocument,
  encodeSketchDocument,
} from '../../sketch/sketchDocument';
import { isSketchSnapshotFresh, sketchContentHash } from '../../sketch/sketchSnapshot';
import type { SketchStroke } from '../../sketch/sketchTypes';

const stroke: SketchStroke = {
  kind: 'stroke',
  brush: 'pen',
  color: '#000000',
  alpha: 1,
  size: 3,
  points: [0, 0, 10, 10],
};

const drawn = () => {
  const doc = decodeSketchDocument(emptySketchContent('l1', 'Layer'));
  return encodeSketchDocument(appendStroke(doc, doc.layers[0].id, stroke));
};

describe('sketchContentHash', () => {
  it('is the same for the same drawing and different for another', () => {
    expect(sketchContentHash(drawn())).toBe(sketchContentHash(structuredClone(drawn())));
    expect(sketchContentHash(drawn())).not.toBe(
      sketchContentHash(emptySketchContent('l1', 'Layer')),
    );
  });

  it('does not depend on the order the keys came in', () => {
    const content = emptySketchContent('l1', 'Layer');
    const reordered = { overlays: content.overlays, layers: content.layers, page: content.page };
    expect(sketchContentHash(reordered)).toBe(sketchContentHash(content));
  });

  it('is a short fixed-width hex string', () => {
    expect(sketchContentHash(drawn())).toMatch(/^[0-9a-f]{14}$/);
  });

  it('survives an edit that is put back', () => {
    const content = drawn();
    const roundTrip = encodeSketchDocument(decodeSketchDocument(content));
    expect(sketchContentHash(roundTrip)).toBe(sketchContentHash(content));
  });
});

describe('isSketchSnapshotFresh', () => {
  const content = drawn();
  const hash = sketchContentHash(content);

  it('is fresh while the recorded hash matches the drawing', () => {
    expect(isSketchSnapshotFresh({ content, coverGalleryId: 'g', coverSourceHash: hash })).toBe(
      true,
    );
  });

  it('is stale once the drawing changed', () => {
    expect(
      isSketchSnapshotFresh({
        content: emptySketchContent('l1', 'Layer'),
        coverGalleryId: 'g',
        coverSourceHash: hash,
      }),
    ).toBe(false);
  });

  it('is stale with no cover, or a cover that predates the hash', () => {
    expect(isSketchSnapshotFresh({ content, coverGalleryId: null, coverSourceHash: hash })).toBe(
      false,
    );
    expect(isSketchSnapshotFresh({ content, coverGalleryId: 'g', coverSourceHash: null })).toBe(
      false,
    );
  });
});
