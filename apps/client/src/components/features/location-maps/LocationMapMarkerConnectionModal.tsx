import GraphConnectionModal from '@/src/components/features/graphs/GraphConnectionModal/GraphConnectionModal';
import type { LocationMapContentType } from '@keres/shared';
import React from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { addLocationMapMarkerConnection } from '@/src/utils/locationMapContent';

interface Props {
  pair: { from: string; to: string };
  content: LocationMapContentType;
  locationNames: Record<string, string>;
  setContent: Dispatch<SetStateAction<LocationMapContentType>>;
  onClose: () => void;
}

/** Saves marker-involved links inside the map, since free markers have no story-wide relation. */
const LocationMapMarkerConnectionModal: React.FC<Props> = ({
  pair,
  content,
  locationNames,
  setContent,
  onClose,
}) => (
  <GraphConnectionModal
    sourceName={
      content.nodes.find((point) => point.id === pair.from)?.labelAtPin ??
      locationNames[content.nodes.find((point) => point.id === pair.from)?.locationId ?? ''] ??
      content.markers?.find((point) => point.id === pair.from)?.title ??
      pair.from
    }
    targetName={
      content.nodes.find((point) => point.id === pair.to)?.labelAtPin ??
      locationNames[content.nodes.find((point) => point.id === pair.to)?.locationId ?? ''] ??
      content.markers?.find((point) => point.id === pair.to)?.title ??
      pair.to
    }
    labelEnabled
    onClose={onClose}
    onConfirm={({ directed, direction, label }) => {
      setContent((current) =>
        addLocationMapMarkerConnection(current, {
          fromId: direction === 'forward' ? pair.from : pair.to,
          toId: direction === 'forward' ? pair.to : pair.from,
          directed,
          label,
        }),
      );
      onClose();
    }}
  />
);

export default LocationMapMarkerConnectionModal;
