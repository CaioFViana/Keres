/** @jest-environment node */
import {
  __resetGuideAnchorsForTests,
  drawerAnchorId,
  measureGuideAnchors,
  registerGuideAnchor,
  unionGuideRects,
  unregisterGuideAnchor,
} from '../../src/guides/anchorRegistry';

beforeEach(() => {
  __resetGuideAnchorsForTests();
});

describe('drawerAnchorId', () => {
  it('names drawer entries by navigator and route', () => {
    expect(drawerAnchorId('main-system', 'CharactersStack')).toBe(
      'drawer:main-system:CharactersStack',
    );
  });
});

describe('measureGuideAnchors', () => {
  it('measures every registered id', async () => {
    registerGuideAnchor('a', async () => ({ x: 0, y: 0, width: 10, height: 10 }));
    registerGuideAnchor('b', async () => ({ x: 5, y: 5, width: 10, height: 10 }));

    await expect(measureGuideAnchors(['a', 'b'])).resolves.toHaveLength(2);
  });

  it('skips missing, unmeasurable and throwing anchors instead of failing', async () => {
    registerGuideAnchor('ok', async () => ({ x: 0, y: 0, width: 10, height: 10 }));
    registerGuideAnchor('null', async () => null);
    registerGuideAnchor('boom', async () => {
      throw new Error('measure blew up');
    });

    await expect(measureGuideAnchors(['ok', 'null', 'boom', 'missing'])).resolves.toEqual([
      { x: 0, y: 0, width: 10, height: 10 },
    ]);
  });

  it('forgets unregistered anchors', async () => {
    registerGuideAnchor('a', async () => ({ x: 0, y: 0, width: 10, height: 10 }));
    unregisterGuideAnchor('a');

    await expect(measureGuideAnchors(['a'])).resolves.toEqual([]);
  });
});

describe('unionGuideRects', () => {
  it('covers every input', () => {
    expect(
      unionGuideRects([
        { x: 10, y: 20, width: 30, height: 40 },
        { x: 0, y: 50, width: 20, height: 10 },
      ]),
    ).toEqual({ x: 0, y: 20, width: 40, height: 40 });
  });

  it('ignores zero-area rects from hidden conditional items', () => {
    expect(
      unionGuideRects([
        { x: 0, y: 0, width: 0, height: 0 },
        { x: 10, y: 20, width: 30, height: 40 },
      ]),
    ).toEqual({ x: 10, y: 20, width: 30, height: 40 });
  });

  it('returns null with nothing visible, so the step degrades to card-only', () => {
    expect(unionGuideRects([])).toBeNull();
    expect(unionGuideRects([{ x: 0, y: 0, width: 0, height: 0 }])).toBeNull();
  });
});
