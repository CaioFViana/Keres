import type { LocationMapContentType } from '@keres/shared';
import { useEffect, useMemo, useState } from 'react';
import { loadBoardEntitySummary, type BoardEntitySummary } from '../utils/boardEntitySummary';

/**
 * The selected map point plus its live entity summary. Extracted from the map screen so
 * overlay wiring fits the file-size gate.
 */
export function useLocationMapNodeSummary(
  db: Parameters<typeof loadBoardEntitySummary>[0],
  nodes: LocationMapContentType['nodes'],
  selectedNodeId: string | null,
) {
  const selectedNode = useMemo(
    () => nodes.find((node) => node.id === selectedNodeId) ?? null,
    [nodes, selectedNodeId],
  );
  const [selectedNodeSummary, setSelectedNodeSummary] = useState<BoardEntitySummary | null>(null);

  const [prevDb, setPrevDb] = useState(db);
  const [prevSelectedNode, setPrevSelectedNode] = useState(selectedNode);
  if (db !== prevDb || selectedNode !== prevSelectedNode) {
    setPrevDb(db);
    setPrevSelectedNode(selectedNode);
    setSelectedNodeSummary(null);
  }

  useEffect(() => {
    let cancelled = false;
    if (!selectedNode) return;
    (async () => {
      const summary = await loadBoardEntitySummary(db, 'Location', selectedNode.locationId);
      if (!cancelled) setSelectedNodeSummary(summary);
    })();
    return () => {
      cancelled = true;
    };
  }, [db, selectedNode]);

  return { selectedNode, selectedNodeSummary };
}
