import {
  boundsOfNodes,
  type EdgeEnds,
  focusNeighborhood,
  type PositionedGraphNode,
} from '@keres/shared/graphs/graphNeighborhood';
import {
  type RefObject,
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from 'react';
import type { CanvasViewportHandle } from './canvasViewportTypes';

interface GraphFocusInput<N extends PositionedGraphNode, E> {
  nodes: readonly N[];
  edges: readonly E[];
  ends: EdgeEnds<E>;
  canvasRef: RefObject<CanvasViewportHandle | null>;
  /** Changes whenever the focus filter does; the camera reframes the new map. */
  filterKey: string;
  /** Drops the focus filter, so a node it had hidden can be shown. */
  clearFilter: () => void;
}

/**
 * Which node of a relation graph is in focus. Tapping a node focuses it and opens its details;
 * closing the details leaves the focus, so the author keeps seeing who is around it, and tapping empty
 * canvas lets go. The same state serves finding a node by name and framing the focus.
 */
export function useGraphFocus<N extends PositionedGraphNode, E>({
  nodes,
  edges,
  ends,
  canvasRef,
  filterKey,
  clearFilter,
}: GraphFocusInput<N, E>) {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  /** A node asked for by name that the map may not have yet (the filter hides it): framed once it does. */
  const pendingFrameId = useRef<string | null>(null);
  const [goToRequests, requestGoTo] = useReducer((count: number) => count + 1, 0);

  const selectedNode = useMemo(
    () => nodes.find((node) => node.id === selectedNodeId) ?? null,
    [nodes, selectedNodeId],
  );

  const focusNodeIds = useMemo(
    () => (selectedNode ? focusNeighborhood(edges, ends, [selectedNode.id]) : null),
    [edges, ends, selectedNode],
  );

  const frame = useCallback(
    (ids: ReadonlySet<string>) => {
      const bounds = boundsOfNodes(nodes, ids);
      if (bounds) canvasRef.current?.fitToRect(bounds);
    },
    [canvasRef, nodes],
  );

  // A new filter is a new map: frame it, but not on the first render, where the canvas fits itself.
  const lastFilterKey = useRef(filterKey);
  useEffect(() => {
    if (lastFilterKey.current === filterKey) return;
    lastFilterKey.current = filterKey;
    canvasRef.current?.fitToScreen();
  }, [canvasRef, filterKey]);

  // After the map has the node, centre on it with the ones around it.
  useEffect(() => {
    const id = pendingFrameId.current;
    if (!id || !nodes.some((node) => node.id === id)) return;
    pendingFrameId.current = null;
    frame(focusNeighborhood(edges, ends, [id]));
  }, [edges, ends, frame, goToRequests, nodes]);

  const tapNode = useCallback((id: string) => {
    setSelectedNodeId(id);
    setDetailsOpen(true);
  }, []);
  const selectNode = useCallback((id: string) => setSelectedNodeId(id), []);
  const closeDetails = useCallback(() => setDetailsOpen(false), []);
  const clearFocus = useCallback(() => {
    setSelectedNodeId(null);
    setDetailsOpen(false);
  }, []);
  const goToNode = useCallback(
    (id: string) => {
      if (!nodes.some((node) => node.id === id)) clearFilter();
      setDetailsOpen(false);
      setSelectedNodeId(id);
      pendingFrameId.current = id;
      requestGoTo();
    },
    [clearFilter, nodes],
  );
  const centerSelection = useCallback(() => {
    if (focusNodeIds) frame(focusNodeIds);
  }, [focusNodeIds, frame]);

  return {
    selectedNodeId,
    selectedNode,
    detailsOpen,
    focusNodeIds,
    /** A tap on a node: focus it and show its details. */
    tapNode,
    /** A pick from the details (a neighbour): focus moves, the details stay. */
    selectNode,
    closeDetails,
    /** Lets go of the focus altogether. */
    clearFocus,
    /** Goes to a node by id: lifts the filter if it hides it, then centres on it and its neighbours. */
    goToNode,
    /** Frames the focused node together with its neighbours. */
    centerSelection,
  };
}
