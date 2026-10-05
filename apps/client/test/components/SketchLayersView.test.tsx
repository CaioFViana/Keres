import { render } from '@testing-library/react-native';
import type { SketchItem, SketchLayerDoc } from '@keres/shared';
import SketchLayersView from '../../src/components/features/sketches/SketchLayersView';
import {
  SKETCH_PICTURE_CHUNK,
  SketchLayerPictures,
  recordSketchPicture,
  sketchItemPath,
} from '../../src/components/features/sketches/sketchPictures';

function line(x: number): SketchItem {
  return {
    kind: 'stroke',
    brush: 'pen',
    color: '#112233',
    alpha: 1,
    size: 3,
    points: [x, 0, x + 10, 10],
  };
}
const fill: SketchItem = {
  kind: 'fill',
  color: '#ff0000',
  alpha: 0.5,
  rings: [[0, 0, 10, 0, 10, 10]],
};

function layer(
  id: string,
  items: SketchItem[],
  overrides: Partial<SketchLayerDoc> = {},
): SketchLayerDoc {
  return { id, name: id, visible: true, opacity: 1, locked: false, items, ...overrides };
}

describe('sketch pictures', () => {
  it('parses each item path once and marks fills even-odd', () => {
    const stroke = line(1);
    expect(sketchItemPath(stroke)).toBe(sketchItemPath(stroke));
    expect((sketchItemPath(fill) as unknown as { fillType: number }).fillType).toBe(1);
  });

  it('records one draw per item with the paint of that item', () => {
    const picture = recordSketchPicture([line(0), fill]) as unknown as {
      commands: { path: { d: string }; paint: Record<string, unknown> }[];
    };
    expect(picture.commands).toHaveLength(2);
    expect(picture.commands[0].paint).toMatchObject({
      color: '#112233',
      strokeWidth: 3,
      style: 1,
      strokeCap: 1,
    });
    expect(picture.commands[1].paint).toMatchObject({ color: '#ff0000', alpha: 0.5, style: 0 });
  });

  it('re-records only the chunks an edit touched', () => {
    const cache = new SketchLayerPictures();
    const items = Array.from({ length: SKETCH_PICTURE_CHUNK * 2 + 5 }, (_, index) => line(index));
    const first = cache.update(items);
    expect(first).toHaveLength(3);
    expect(cache.update(items)).toEqual(first);
    const second = cache.update([...items, line(999)]);
    // The new stroke only changes the tail chunk.
    expect(second[0]).toBe(first[0]);
    expect(second[1]).toBe(first[1]);
    expect(second[2]).not.toBe(first[2]);
  });
});

describe('SketchLayersView', () => {
  it('draws visible layers bottom to top, each with its opacity', async () => {
    const view = await render(
      <SketchLayersView
        layers={[
          layer('A', [line(0)]),
          layer('B', [line(1)], { opacity: 0.4 }),
          layer('C', [line(2)], { visible: false }),
        ]}
        transform={null}
      />,
    );
    const groups = view.container.queryAll((node) => node.type === 'SkiaGroup');
    expect(groups).toHaveLength(2);
    // A full-opacity layer needs no offscreen layer; a faded one gets a layer paint at its alpha
    // (Group's `opacity` prop would not reach the recorded pictures).
    expect(groups[0].props.layer).toBeUndefined();
    expect(groups[1].props.layer.alpha).toBe(0.4);
    expect(groups[1].props.opacity).toBeUndefined();
  });

  it('draws the eraser path as a Clear stroke inside the layer it works on', async () => {
    const view = await render(
      <SketchLayersView
        layers={[layer('A', [line(0)]), layer('B', [line(1)])]}
        transform={null}
        erase={{ layerId: 'B', path: [10, 10, 40, 10], radius: 6, version: 1 }}
      />,
    );
    const clears = view.container.queryAll(
      (node) => node.type === 'SkiaPath' && node.props.blendMode === 'clear',
    );
    expect(clears).toHaveLength(1);
    expect(clears[0].props).toMatchObject({ strokeWidth: 12, style: 'stroke', strokeCap: 'round' });
    // The layer composites on its own so the clear cannot reach the other layers.
    const groups = view.container.queryAll((node) => node.type === 'SkiaGroup');
    expect(groups[0].props.layer).toBeUndefined();
    expect(groups[1].props.layer).toBe(true);
  });

  it('lifts the dragged selection out of its layer while it moves', async () => {
    const dragged = line(5);
    const resting = line(50);
    const layers = [layer('A', [resting, dragged])];
    const matrix = { a: 1, b: 0, c: 0, d: 1, e: 12, f: 7 };
    const view = await render(
      <SketchLayersView
        layers={layers}
        transform={{ layerId: 'A', items: new Set([dragged]), matrix }}
      />,
    );
    const pictures = view.container.queryAll((node) => node.type === 'SkiaPicture');
    // One picture for what stays, one for what moves, the latter inside a matrix group.
    expect(pictures).toHaveLength(2);
    const moving = view.container.queryAll(
      (node) => node.type === 'SkiaGroup' && node.props.matrix,
    );
    expect(moving).toHaveLength(1);
    expect(moving[0].props.matrix.values).toEqual([1, 0, 12, 0, 1, 7, 0, 0, 1]);
  });
});
