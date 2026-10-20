# Sketch v2 — sketch board (strokes + fills, no raster)

**Status:** implemented (code phases 1–5); performance on a real device is still to be measured (see "Open risks").
**Origin:** v1 (commit `820ecc60`) was a third variant of Board/Map: each stroke became a selectable
`CanvasOverlay`, a momentary tool, with no eraser or bucket and a cap of 200 objects.
**Goal:** a basic yet rich sketching tool — brush, eraser, bucket, layers, select/move, sheet size,
export and Gallery — light enough to hold many, and useful for scripts and comic roughs.

## Frozen decisions

- **No persisted bitmap.** Each layer holds a list of *items* (strokes and fills) in a single compact
  string inside the sketch JSON. The only PNG is the export the user asks for.
- **Self-contained, transformable items.** The eraser is **geometric** (it cuts the stroke and splits it), never
  `BlendMode.Clear`; so moving/scaling/rotating part of the drawing is just applying a matrix to the points.
- **Bucket = vector outline.** The flood fill runs in memory over what the user sees; what is stored are the
  region's rings (even-odd), not pixels. The result is identical on every platform. Fills sit in a block
  *below the strokes* of the layer (the line always covers the colour's edge).
- **Objects (text, balloon, stamp) stay vector** and always sit above the drawing layers.
- **No migration:** v1 never shipped in a release; the schema was rewritten in place (no `version`, no compat).
- The eraser cuts strokes on the spot (geometric) and fills when the pen is lifted: the fill is painted onto a mask, the path is erased and the remaining region is traced back into rings. During the gesture, the path shows as a Clear stroke over the layer.
- Lasso selection: "whole strokes" mode (≥ 50% inside) or "cut at the lasso". Fills are always whole.

## Format (`packages/shared/sketch/`)

```
layer.data = base64( deflate( bytes ) )          // '' = empty layer
bytes      = u8 fmt(1) | varint nItems | items
stroke     = u8 0 | u8 brush | rgb | alpha | varint size*4 | varint n | n points (delta, zigzag, 1/4 px)
fill       = u8 1 | rgb | alpha | varint nRings | per ring: varint n | n points (delta)
```

- Brushes: `pen`, `marker`, `highlighter` (solid stroke with opacity; no textures, no blend modes).
- Caps: items/layer, points/stroke, **bytes per sketch** (`MAX_SKETCH_TOTAL_DATA_LENGTH`) and a cap on bytes
  *after* decompression (`MAX_SKETCH_LAYER_DECODED_BYTES`) against a decompression bomb on the server.
- The editor holds the items by reference (immutable): history snapshots share everything, the history
  has 300 entries and `doc !== savedDoc` is the dirty check (O(1)).
- **Compaction on save:** degenerate items are dropped and strokes are re-simplified (only in the persisted copy;
  the session's undo stays exact). The geometric eraser already leaves no junk, so there is no "compact button".
- Draft (WIP): stores only the encoded `content` + `baseVersion`, with a 1.2 s delay (encoding is the
  expensive part) and a flush when the app goes to the background. There is no second copy of the saved sketch.

## Experience

- The tool stays **armed** (a mode, not a gesture). One finger draws; two fingers move/zoom/rotate the view; the
  hand tool gives the single finger back to the camera.
- Scrollable tool strip (hand, selection, brush, eraser, bucket, eyedropper, line, rectangle,
  ellipse, text, balloon, stamp | undo, redo, layers, sheet) and a contextual options strip right below
  (brush type, colour, size, opacity; bucket tolerance and scope; selection actions).
- Desktop shortcuts: `B E G I V H L R O T`, `[` `]` (size), `Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y`.
- Layers: reorder, hide, lock, opacity, duplicate, merge down, clear, delete.
- Sheet: presets (A4, A5, square, wide, webtoon) or a free size, orientation, background (paper, white,
  transparent). Changing the size never moves the drawing.
- Export: SVG (strokes as paths), PNG (transparent included) and "save to Gallery" (links the cover).
- Warnings: hidden/locked/full layer, sketch near 80% of the limit and at the limit.

## What was verified and how

- Pure engine (`packages/shared`): codec (round-trip, bomb, truncated), geometry (smoothing with corners,
  eraser, lasso, transforms, compaction), bucket (flood fill + outlines with holes), selection, document.
- Rendering checked against **real CanvasKit** (`canvaskit-wasm`, the same engine as the web): paths, even-odd fills,
  flood fill over real pixels and the eraser. It found and fixed the corner rounding.
- Client: gestures (`SketchInputLayer`), layers/pictures, options bar, slider, draft, SVG and the whole
  screen (history, eraser, bucket, lasso, move, duplicate, save, revert, draft).
- API: sketch sync with a real drawing and rejection of corrupted data.

## Open risks (not measured — they depend on a device)

1. **Pan/zoom performance with very full pages:** each frame replays every `Picture`. If it gets heavy,
   mitigate with a disposable raster cache during the camera gesture.
2. **Time to open** a large sketch (replaying thousands of strokes): synchronous today.
3. **Memory:** only `Picture`s in RAM, no bitmaps; the bucket's `SkSurface` is temporary (≤ 1800 px a side).
4. **Skia on the web:** `createPicture`, `MakeOffscreen` and `readPixels` were not exercised in a real browser
   (only CanvasKit directly). Validate on the web build and on Android/iOS.
5. **Sync:** the whole `content` goes on each save (a large sketch = a few hundred KB per log entry).
   Manual save keeps that low; if it becomes a problem, split the data per layer.

## Out of scope for this version
Multi-page (sketchbook), pen pressure/tilt, brush textures,
automatic thumbnail in the list, export with layers (ORA).
