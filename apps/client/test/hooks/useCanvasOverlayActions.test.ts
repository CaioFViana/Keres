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
      placementCenter: () => ({ x: 200, y: 160 }),
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
    expect(result.current.content.overlays).toHaveLength(1);
    expect(result.current.content.overlays?.[0]).toMatchObject({ kind: 'polygon' });
    expect(result.current.content.overlays?.[0]).toHaveProperty('points');
    expect(
      (result.current.content.overlays?.[0] as { points: unknown[] }).points,
    ).toHaveLength(10);
    expect(result.current.actions.selectedOverlayId).toBe('id-1');

    await act(async () => result.current.actions.handleObjectsAction('select'));
    expect(result.current.actions.interactionMode).toEqual({ kind: 'select' });
    expect(result.current.actions.selectedOverlayId).toBeNull();

    await act(async () => result.current.actions.handleObjectsAction('note'));
    expect(result.current.onAddNote).toHaveBeenCalledTimes(1);
    expect(result.current.actions.interactionMode).toBeNull();
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
});
