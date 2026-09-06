import { act, renderHook } from '@testing-library/react-native';
import { useState } from 'react';
import type { BoardContentType } from '@keres/shared';
import { useBoardCanvasLayout } from '../../src/hooks/useBoardCanvasLayout';

describe('useBoardCanvasLayout', () => {
  it('moves a node inside the world bounds without changing other nodes', async () => {
    const view = await renderHook(() => {
      const [content, setContent] = useState({
        nodes: [
          { id: 'a', x: 0, y: 0, width: 200, height: 100 },
          { id: 'b', x: 10, y: 20, width: 200, height: 100 },
        ],
        edges: [],
      } as unknown as BoardContentType);
      return { content, ...useBoardCanvasLayout(setContent) };
    });

    await act(async () =>
      view.result.current.handleMoveNode('a', Number.POSITIVE_INFINITY, -50000),
    );
    expect(view.result.current.content.nodes).toMatchObject([
      { id: 'a', x: 0, y: -50000 },
      { id: 'b', x: 10, y: 20 },
    ]);
  });

  it('clamps node size and moves its layer before or behind every existing node', async () => {
    const view = await renderHook(() => {
      const [content, setContent] = useState({
        nodes: [
          { id: 'a', x: 0, y: 0, width: 200, height: 100, zIndex: 2 },
          { id: 'b', x: 0, y: 0, width: 200, height: 100, zIndex: -1 },
        ],
        edges: [],
      } as unknown as BoardContentType);
      return { content, ...useBoardCanvasLayout(setContent) };
    });

    await act(async () => view.result.current.handleResizeNode('a', 1000, 1));
    await act(async () => view.result.current.moveNodeLayer('b', 'front'));
    expect(view.result.current.content.nodes).toMatchObject([
      { id: 'a', width: 720, height: 86, zIndex: 2 },
      { id: 'b', zIndex: 3 },
    ]);

    await act(async () => view.result.current.moveNodeLayer('a', 'back'));
    expect(view.result.current.content.nodes[0]).toMatchObject({ zIndex: -1 });
  });
});
