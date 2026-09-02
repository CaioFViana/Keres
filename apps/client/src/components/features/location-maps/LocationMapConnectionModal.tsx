import GraphConnectionModal from '@/src/components/features/graphs/GraphConnectionModal/GraphConnectionModal';
import type { LocationMapContentType } from '@keres/shared';
import React from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { useTranslation } from 'react-i18next';
import { setLocationMapRelationText } from '@/src/utils/locationMapContent';

interface Props {
  pair: { from: string; to: string };
  nodeNames: Record<string, string>;
  setContent: Dispatch<SetStateAction<LocationMapContentType>>;
  onConnect: (locationAId: string, locationBId: string) => void;
  onSetParent: (childLocationId: string, parentLocationId: string) => void;
  onClose: () => void;
}

/** Persists canvas links as real Location relations: undirected connections or directional contains arrows. */
const LocationMapConnectionModal: React.FC<Props> = ({
  pair,
  nodeNames,
  setContent,
  onConnect,
  onSetParent,
  onClose,
}) => {
  const { t } = useTranslation();
  const sourceName = nodeNames[pair.from] ?? pair.from;
  const targetName = nodeNames[pair.to] ?? pair.to;
  return (
    <GraphConnectionModal
      sourceName={sourceName}
      targetName={targetName}
      labelEnabled
      directionHint={t('location_map_connection_direction_hint')}
      onClose={onClose}
      onConfirm={({ directed, direction, label }) => {
        const sourceLocationId = !directed || direction === 'forward' ? pair.from : pair.to;
        const destinationLocationId = !directed || direction === 'forward' ? pair.to : pair.from;
        setContent((current) =>
          setLocationMapRelationText(current, sourceLocationId, destinationLocationId, label),
        );
        if (!directed) onConnect(pair.from, pair.to);
        else if (direction === 'forward') onSetParent(pair.to, pair.from);
        else onSetParent(pair.from, pair.to);
        onClose();
      }}
    />
  );
};

export default LocationMapConnectionModal;
