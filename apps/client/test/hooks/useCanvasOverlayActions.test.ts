import { act, renderHook } from '@testing-library/react-native';
import { useState } from 'react';
import type { BoardContentType } from '@keres/shared';
import { useCanvasOverlayActions } from '../../src/hooks/useCanvasOverlayActions';

const EMPTY = { nodes: [], edges: [] } as unknown as BoardContentType;

async function setup(initial: BoardContentType = EMPTY) {
  let ids = 0;
  const onAddNote = jest.fn();
  const view = await renderHook(() => {
    const [content, setContent] = useState(initial);
    const actions = useCanvasOverlayActions({
      setContent,
      generateOverlayId: () => `id-${(ids += 1)}`,
      onAddNote,
    });
    return { content, actions, onAddNote };
  });
  return view.result;
}

describe('useCanvasOverlayActions', () => {
  it('routes pill actions to tools, presets and notes', async () => {
    const result = await setup();

    await act(async () => result.current.actions.handleObjectsAction('draw:line'));
    expect(result.current.actions.interactionMode).toEqual({ kind: 'draw', tool: 'line' });

    await act(async () => result.current.actions.handleObjectsAction('preset:star'));
    expect(result.current.actions.interactionMode).toEqual({
      kind: 'draw',
      tool: 'preset:star',
    });
    await act(async () =>
      result.current.actions.commitRectDraw('preset:star', { x: 0, y: 0 }, { x: 100, y: 100 }),
    );
    expect(result.current.content.overlays).toHaveLength(1);
    expect(result.current.content.overlays?.[0]).toMatchObject({ kind: 'polygon' });
    expect(result.current.content.overlays?.[0]).toHaveProperty('points');
    expect((result.current.content.overlays?.[0] as { points: unknown[] }).points).toHaveLength(10);
    expect(result.current.actions.selectedOverlayId).toBe('id-1');
    expect(result.current.actions.interactionMode).toBeNull();

    await act(async () => result.current.actions.handleObjectsAction('select'));
    expect(result.current.actions.interactionMode).toEqual({ kind: 'select' });
    expect(result.current.actions.selectedOverlayId).toBeNull();

    await act(async () => result.current.actions.handleObjectsAction('note'));
    expect(result.current.onAddNote).toHaveBeenCalledTimes(1);
    expect(result.current.actions.interactionMode).toBeNull();
  });

  describe('speech balloons', () => {
    const drawBalloon = async () => {
      const result = await setup();
      await act(async () => result.current.actions.handleObjectsAction('draw:balloon'));
      await act(async () =>
        result.current.actions.commitRectDraw('balloon', { x: 100, y: 100 }, { x: 300, y: 200 }),
      );
      return result;
    };
    type Balloon = {
      kind: 'balloon';
      x: number;
      y: number;
      width: number;
      height: number;
      tail: { x: number; y: number };
      content: string;
    };
    const balloon = (result: Awaited<ReturnType<typeof setup>>) =>
      result.current.content.overlays?.[0] as unknown as Balloon;

    it('draws one ellipse with a tail out of the south-east axis and opens its sheet', async () => {
      const result = await drawBalloon();
      expect(balloon(result)).toMatchObject({
        kind: 'balloon',
        x: 100,
        y: 100,
        width: 200,
        height: 100,
        content: '',
      });
      expect(balloon(result).tail.x).toBeGreaterThan(300 - 40);
      expect(balloon(result).tail.y).toBeGreaterThan(200 - 40);
      expect(result.current.actions.sheetOverlayId).toBe('id-1');
      expect(result.current.actions.interactionMode).toBeNull();
    });

    it('moves the tail with the body', async () => {
      const result = await drawBalloon();
      const before = balloon(result).tail;
      await act(async () => result.current.actions.commitMove('id-1', 30, -10));
      expect(balloon(result)).toMatchObject({ x: 130, y: 90 });
      expect(balloon(result).tail).toEqual({ x: before.x + 30, y: before.y - 10 });
    });

    it('keeps the tail tip put while the ellipse is resized, and clear of the outline', async () => {
      const result = await drawBalloon();
      await act(async () => result.current.actions.commitTail('id-1', { x: 420, y: 320 }));
      await act(async () =>
        result.current.actions.commitRectEdit('id-1', { x: 100, y: 100, width: 300, height: 200 }),
      );
      // The tip (420,320) would now sit too close to the bigger ellipse, so it is pushed out.
      const { tail } = balloon(result);
      const radius = Math.hypot((tail.x - 250) / 150, (tail.y - 200) / 100);
      expect(radius).toBeGreaterThanOrEqual(1.25 - 1e-9);
    });

    it('commits a dragged tail tip and ignores locked balloons', async () => {
      const result = await drawBalloon();
      await act(async () => result.current.actions.commitTail('id-1', { x: 50, y: 40 }));
      expect(balloon(result).tail).toEqual({ x: 50, y: 40 });
      await act(async () => result.current.actions.toggleOverlayLock('id-1'));
      await act(async () => result.current.actions.commitTail('id-1', { x: 0, y: 0 }));
      expect(balloon(result).tail).toEqual({ x: 50, y: 40 });
    });

    it('stores what the character says through the sheet patch', async () => {
      const result = await drawBalloon();
      await act(async () =>
        result.current.actions.updateOverlay('id-1', { content: 'Who goes there?', fontSize: 20 }),
      );
      expect(balloon(result).content).toBe('Who goes there?');
    });
  });

  it('accumulates vertices and finishes valid drafts', async () => {
    const result = await setup();

    await act(async () => result.current.actions.handleObjectsAction('draw:polygon'));
    expect(result.current.actions.canFinish).toBe(false);
    await act(async () => {
      result.current.actions.addDraftPoint({ x: 0, y: 0 });
      result.current.actions.addDraftPoint({ x: 10, y: 0 });
    });
    expect(result.current.actions.canFinish).toBe(false);
    await act(async () => result.current.actions.addDraftPoint({ x: 5, y: 8 }));
    expect(result.current.actions.canFinish).toBe(true);
    await act(async () => result.current.actions.finishDraft());
    expect(result.current.content.overlays).toHaveLength(1);
    expect(result.current.content.overlays?.[0]).toMatchObject({
      kind: 'polygon',
      points: [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 5, y: 8 },
      ],
    });
    expect(result.current.actions.interactionMode).toBeNull();
  });

  it('commits rect drags and ignores tiny ones', async () => {
    const result = await setup();

    await act(async () => result.current.actions.handleObjectsAction('draw:frame'));
    await act(async () =>
      result.current.actions.commitRectDraw('frame', { x: 0, y: 0 }, { x: 100, y: 60 }),
    );
    expect(result.current.content.overlays?.[0]).toMatchObject({
      kind: 'frame',
      x: 0,
      y: 0,
      width: 100,
      height: 60,
    });
    // Backwards drags normalize; tiny drags are discarded without leaving draw mode.
    await act(async () => result.current.actions.handleObjectsAction('draw:rect'));
    await act(async () =>
      result.current.actions.commitRectDraw('rect', { x: 50, y: 50 }, { x: 10, y: 10 }),
    );
    expect(result.current.content.overlays?.[1]).toMatchObject({
      kind: 'shape',
      shapeType: 'rect',
      x: 10,
      y: 10,
      width: 40,
      height: 40,
    });
    await act(async () => result.current.actions.handleObjectsAction('draw:ellipse'));
    await act(async () =>
      result.current.actions.commitRectDraw('ellipse', { x: 0, y: 0 }, { x: 2, y: 2 }),
    );
    expect(result.current.content.overlays).toHaveLength(2);
    expect(result.current.actions.interactionMode).toEqual({ kind: 'draw', tool: 'ellipse' });
  });

  it('selects, patches, moves and deletes overlays', async () => {
    const result = await setup({
      nodes: [],
      edges: [],
      overlays: [
        {
          id: 'ov-1',
          kind: 'line',
          points: [
            { x: 0, y: 0 },
            { x: 10, y: 0 },
          ],
        },
      ],
    } as unknown as BoardContentType);

    await act(async () => result.current.actions.selectOverlay('ov-1'));
    expect(result.current.actions.selectedOverlayId).toBe('ov-1');
    // Selecting never opens the sheet: the handles edit in place.
    expect(result.current.actions.sheetOverlayId).toBeNull();
    await act(async () =>
      result.current.actions.updateOverlay('ov-1', { label: 'Trail', color: '#f00' }),
    );
    expect(result.current.content.overlays?.[0]).toMatchObject({ label: 'Trail', color: '#f00' });

    await act(async () => result.current.actions.commitMove('ov-1', 5, 5));
    expect(result.current.content.overlays?.[0]).toMatchObject({
      points: [
        { x: 5, y: 5 },
        { x: 15, y: 5 },
      ],
    });
    await act(async () => result.current.actions.commitVertex('ov-1', 1, { x: 20, y: 20 }));
    expect(result.current.content.overlays?.[0]).toMatchObject({
      points: [
        { x: 5, y: 5 },
        { x: 20, y: 20 },
      ],
    });
    await act(async () => result.current.actions.deleteOverlay('ov-1'));
    expect(result.current.content.overlays).toHaveLength(0);
    expect(result.current.actions.selectedOverlayId).toBeNull();
  });

  it('toggles the lock and ignores geometry commits while locked', async () => {
    const result = await setup({
      nodes: [],
      edges: [],
      overlays: [
        {
          id: 'ov-1',
          kind: 'line',
          points: [
            { x: 0, y: 0 },
            { x: 10, y: 0 },
          ],
        },
        { id: 'ov-2', kind: 'frame', x: 0, y: 0, width: 60, height: 40 },
      ],
    } as unknown as BoardContentType);

    await act(async () => result.current.actions.toggleOverlayLock('ov-2'));
    await act(async () =>
      result.current.actions.commitRectEdit('ov-2', { x: 5, y: 5, width: 70, height: 50 }),
    );
    expect(result.current.content.overlays?.[1]).toMatchObject({
      x: 0,
      y: 0,
      width: 60,
      height: 40,
    });
    await act(async () => result.current.actions.toggleOverlayLock('ov-1'));
    expect(result.current.content.overlays?.[0]).toMatchObject({ locked: true });
    await act(async () => result.current.actions.commitMove('ov-1', 5, 5));
    await act(async () => result.current.actions.commitVertex('ov-1', 1, { x: 20, y: 20 }));
    expect(result.current.content.overlays?.[0]).toMatchObject({
      points: [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
      ],
    });
    // Sheet edits still land: the lock only guards canvas drags, like map images.
    await act(async () => result.current.actions.updateOverlay('ov-1', { label: 'Kept' }));
    expect(result.current.content.overlays?.[0]).toMatchObject({ label: 'Kept' });
    await act(async () => result.current.actions.toggleOverlayLock('ov-1'));
    expect(result.current.content.overlays?.[0]).toMatchObject({ locked: false });
    await act(async () => result.current.actions.commitMove('ov-1', 5, 5));
    expect(result.current.content.overlays?.[0]).toMatchObject({
      points: [
        { x: 5, y: 5 },
        { x: 15, y: 5 },
      ],
    });
  });

  it('keeps select mode across picks and hides the catcher while selected', async () => {
    const result = await setup({
      nodes: [],
      edges: [],
      overlays: [
        { id: 'ov-1', kind: 'line', points: [{ x: 0, y: 0 }] },
        { id: 'ov-2', kind: 'line', points: [{ x: 0, y: 0 }] },
      ],
    } as unknown as BoardContentType);

    await act(async () => result.current.actions.handleObjectsAction('select'));
    expect(result.current.actions.interactionMode).toEqual({ kind: 'select' });

    // A hit keeps the mode but unmounts the catcher so the handles stay touchable.
    await act(async () => result.current.actions.selectOverlay('ov-1'));
    expect(result.current.actions.selectedOverlayId).toBe('ov-1');
    expect(result.current.actions.selectMode).toBe(true);
    expect(result.current.actions.interactionMode).toBeNull();

    // Deselect brings the catcher back for the next pick.
    await act(async () => result.current.actions.deselectOverlay());
    expect(result.current.actions.selectedOverlayId).toBeNull();
    expect(result.current.actions.interactionMode).toEqual({ kind: 'select' });
    await act(async () => result.current.actions.selectOverlay('ov-2'));
    expect(result.current.actions.selectedOverlayId).toBe('ov-2');

    // A miss only deselects: the header toggle owns the mode now.
    await act(async () => result.current.actions.selectOverlay(null));
    expect(result.current.actions.selectedOverlayId).toBeNull();
    expect(result.current.actions.selectMode).toBe(true);
    expect(result.current.actions.interactionMode).toEqual({ kind: 'select' });

    await act(async () => result.current.actions.cancelSelect());
    expect(result.current.actions.selectMode).toBe(false);
    expect(result.current.actions.interactionMode).toBeNull();
  });

  it('opens the sheet on creation and details, closing back to the handles', async () => {
    const result = await setup();

    await act(async () => result.current.actions.handleObjectsAction('draw:stamp'));
    await act(async () => result.current.actions.onStampPlace({ x: 10, y: 20 }));
    expect(result.current.actions.sheetOverlayId).toBe('id-1');

    // Closing the sheet keeps the selection: the handles stay up.
    await act(async () => result.current.actions.closeOverlaySheet());
    expect(result.current.actions.sheetOverlayId).toBeNull();
    expect(result.current.actions.selectedOverlayId).toBe('id-1');

    await act(async () => result.current.actions.openOverlaySheet('id-1'));
    expect(result.current.actions.sheetOverlayId).toBe('id-1');
    await act(async () => result.current.actions.deleteOverlay('id-1'));
    expect(result.current.actions.sheetOverlayId).toBeNull();
    expect(result.current.actions.selectedOverlayId).toBeNull();
  });

  it('moves overlays past the stack extremes', async () => {
    const result = await setup({
      nodes: [],
      edges: [],
      overlays: [
        { id: 'ov-1', kind: 'line', points: [], zIndex: 2 },
        { id: 'ov-2', kind: 'line', points: [] },
      ],
    } as unknown as BoardContentType);

    await act(async () => result.current.actions.moveOverlayLayer('ov-2', 'front'));
    expect(result.current.content.overlays?.[1]).toMatchObject({ zIndex: 3 });
    await act(async () => result.current.actions.moveOverlayLayer('ov-1', 'back'));
    expect(result.current.content.overlays?.[0]).toMatchObject({ zIndex: -1 });
  });

  it('arms the stamp tool and commits one stamp per tap', async () => {
    const result = await setup();

    await act(async () => result.current.actions.handleObjectsAction('draw:stamp'));
    expect(result.current.actions.interactionMode).toEqual({ kind: 'draw', tool: 'stamp' });
    expect(result.current.actions.canFinish).toBe(false);

    await act(async () => result.current.actions.onStampPlace({ x: 10, y: 20 }));
    expect(result.current.content.overlays).toHaveLength(1);
    expect(result.current.content.overlays?.[0]).toMatchObject({
      kind: 'stamp',
      x: 10,
      y: 20,
      icon: 'flag',
    });
    expect(result.current.actions.selectedOverlayId).toBe('id-1');
    expect(result.current.actions.interactionMode).toBeNull();
  });

  it('updates a stamp icon through the sheet patch', async () => {
    const result = await setup({
      nodes: [],
      edges: [],
      overlays: [{ id: 'ov-1', kind: 'stamp', x: 0, y: 0, icon: 'flag' }],
    } as unknown as BoardContentType);

    await act(async () => result.current.actions.updateOverlay('ov-1', { icon: 'castle' }));
    expect(result.current.content.overlays?.[0]).toMatchObject({ icon: 'castle' });
  });
});
