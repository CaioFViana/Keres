import type { BoardContentType } from '@keres/shared';
import { generateBoardLocalId } from '@keres/shared';
import React from 'react';
import type { Dispatch, SetStateAction } from 'react';
import GraphConnectionModal from '@/src/components/features/graphs/GraphConnectionModal/GraphConnectionModal';

interface Props {
  pair: { from: string; to: string };
  nodeTitles: Record<string, string>;
  setContent: Dispatch<SetStateAction<BoardContentType>>;
  onClose: () => void;
}

/** Board-specific persistence for the shared drag-to-connect confirmation. */
const BoardConnectionModal: React.FC<Props> = ({ pair, nodeTitles, setContent, onClose }) => (
  <GraphConnectionModal
    sourceName={nodeTitles[pair.from] ?? pair.from}
    targetName={nodeTitles[pair.to] ?? pair.to}
    labelEnabled
    onClose={onClose}
    onConfirm={({ directed, direction, label }) => {
      setContent((current) => {
        const exists = current.edges.some(
          (edge) =>
            (edge.from === pair.from && edge.to === pair.to) ||
            (edge.from === pair.to && edge.to === pair.from),
        );
        if (exists) return current;
        const existing = new Set([
          ...current.nodes.map((node) => node.id),
          ...current.edges.map((edge) => edge.id),
        ]);
        return {
          ...current,
          edges: [
            ...current.edges,
            {
              id: generateBoardLocalId(existing),
              from: direction === 'forward' ? pair.from : pair.to,
              to: direction === 'forward' ? pair.to : pair.from,
              directed,
              label,
            },
          ],
        };
      });
      onClose();
    }}
  />
);

export default BoardConnectionModal;
