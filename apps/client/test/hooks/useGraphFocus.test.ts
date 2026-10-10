/**
 * @jest-environment node
 */
import { act, renderHook } from '@testing-library/react-native';
import { useGraphFocus } from '../../src/hooks/useGraphFocus';

type Edge = { from: string; to: string };
const ends = (edge: Edge) => [edge.from, edge.to] as const;

const node = (id: string, x: number, y = 0) => ({ id, x, y, width: 100, height: 40 });
// a - b - c, with d alone.
const NODES = [node('a', 0), node('b', 200), node('c', 400), node('d', 1000)];
const EDGES: Edge[] = [
  { from: 'a', to: 'b' },
  { from: 'b', to: 'c' },
];

async function setup(overrides: { nodes?: typeof NODES; filterKey?: string } = {}) {
  const canvasRef = { current: { fitToRect: jest.fn(), fitToScreen: jest.fn() } };
  const clearFilter = jest.fn();
  const view = await renderHook(
    ({ nodes, filterKey }: { nodes: typeof NODES; filterKey: string }) =>
      useGraphFocus({
        nodes,
        edges: EDGES,
        ends,
        canvasRef: canvasRef as never,
        filterKey,
        clearFilter,
      }),
    { initialProps: { nodes: overrides.nodes ?? NODES, filterKey: overrides.filterKey ?? '' } },
  );
  return { canvasRef, clearFilter, ...view };
}

describe('useGraphFocus', () => {
  it('starts with nothing in focus', async () => {
    const { result } = await setup();

    expect(result.current.selectedNode).toBeNull();
    expect(result.current.focusNodeIds).toBeNull();
    expect(result.current.detailsOpen).toBe(false);
  });

  it('focuses a tapped node with its neighbours and opens its details', async () => {
    const { result } = await setup();

    await act(async () => result.current.tapNode('b'));

    expect(result.current.selectedNode?.id).toBe('b');
    expect([...result.current.focusNodeIds!].sort()).toEqual(['a', 'b', 'c']);
    expect(result.current.detailsOpen).toBe(true);
  });

  it('keeps the focus when the details close', async () => {
    const { result } = await setup();
    await act(async () => result.current.tapNode('a'));

    await act(async () => result.current.closeDetails());

    expect(result.current.detailsOpen).toBe(false);
    expect(result.current.selectedNode?.id).toBe('a');
    expect([...result.current.focusNodeIds!].sort()).toEqual(['a', 'b']);
  });

  it('moves the focus to a neighbour picked in the details, which stay open', async () => {
    const { result } = await setup();
    await act(async () => result.current.tapNode('a'));

    await act(async () => result.current.selectNode('b'));

    expect(result.current.selectedNode?.id).toBe('b');
    expect(result.current.detailsOpen).toBe(true);
  });

  it('lets go of everything on clear', async () => {
    const { result } = await setup();
    await act(async () => result.current.tapNode('b'));

    await act(async () => result.current.clearFocus());

    expect(result.current.selectedNode).toBeNull();
    expect(result.current.focusNodeIds).toBeNull();
    expect(result.current.detailsOpen).toBe(false);
  });

  it('drops a focus whose node has left the map', async () => {
    const { result, rerender } = await setup();
    await act(async () => result.current.tapNode('d'));

    await act(async () => rerender({ nodes: NODES.filter((n) => n.id !== 'd'), filterKey: '' }));

    expect(result.current.selectedNode).toBeNull();
    expect(result.current.focusNodeIds).toBeNull();
  });

  it('frames the focused node with its neighbours', async () => {
    const { result, canvasRef } = await setup();
    await act(async () => result.current.tapNode('a'));

    await act(async () => result.current.centerSelection());

    const rect = canvasRef.current.fitToRect.mock.calls[0][0];
    // a (0..100) and b (200..300), with the air around them.
    expect(rect.x).toBeLessThanOrEqual(0);
    expect(rect.x + rect.width).toBeGreaterThanOrEqual(300);
    expect(rect.x + rect.width).toBeLessThan(400);
  });

  it('frames nothing when nothing is in focus', async () => {
    const { result, canvasRef } = await setup();

    await act(async () => result.current.centerSelection());

    expect(canvasRef.current.fitToRect).not.toHaveBeenCalled();
  });

  describe('going to a node by name', () => {
    it('focuses it and frames it with its neighbours, without opening details', async () => {
      const { result, canvasRef, clearFilter } = await setup();

      await act(async () => result.current.goToNode('c'));

      expect(result.current.selectedNode?.id).toBe('c');
      expect(result.current.detailsOpen).toBe(false);
      expect(canvasRef.current.fitToRect).toHaveBeenCalledTimes(1);
      expect(clearFilter).not.toHaveBeenCalled();
    });

    it('lifts the filter first when the node is hidden by it, and goes once it shows', async () => {
      const hidden = NODES.filter((n) => n.id !== 'd');
      const { result, rerender, canvasRef, clearFilter } = await setup({ nodes: hidden });

      await act(async () => result.current.goToNode('d'));
      expect(clearFilter).toHaveBeenCalledTimes(1);
      expect(result.current.selectedNode).toBeNull();

      await act(async () => rerender({ nodes: NODES, filterKey: '' }));

      expect(result.current.selectedNode?.id).toBe('d');
      expect(canvasRef.current.fitToRect).toHaveBeenCalledTimes(1);
    });
  });

  describe('when the filter changes', () => {
    it('does not move the camera on the first render', async () => {
      const { canvasRef } = await setup({ filterKey: 'a' });

      expect(canvasRef.current.fitToScreen).not.toHaveBeenCalled();
    });

    it('frames the new map once', async () => {
      const { canvasRef, rerender } = await setup({ filterKey: '' });

      await act(async () => rerender({ nodes: NODES, filterKey: 'a,b' }));
      await act(async () => rerender({ nodes: NODES, filterKey: 'a,b' }));

      expect(canvasRef.current.fitToScreen).toHaveBeenCalledTimes(1);
    });
  });
});
