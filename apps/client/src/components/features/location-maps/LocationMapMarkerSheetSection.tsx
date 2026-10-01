import type { LocationMapContentType, LocationMapMarkerType } from '@keres/shared';
import React from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { removeLocationMapPoint } from '../../../utils/locationMapContent';
import LocationMapMarkerSheet from './LocationMapMarkerSheet';

interface LocationMapMarkerSheetSectionProps {
  openedMarker: LocationMapMarkerType | null;
  destinationName: (mapId: string | null | undefined) => string | null;
  destinationOptions: { label: string; value: string }[];
  canEdit: boolean;
  setContent: Dispatch<SetStateAction<LocationMapContentType>>;
  createDestination: (
    draft: { title: string; note?: string | null },
    onCreated: (destinationMapId: string) => void,
  ) => void;
  openDestination: (destinationMapId: string | null | undefined) => void;
  setSelectedMarkerId: (id: string | null) => void;
  setOpenedMarkerId: (id: string | null) => void;
}

/** The opened free marker's editor, extracted so the map screen fits the file-size gate. */
const LocationMapMarkerSheetSection: React.FC<LocationMapMarkerSheetSectionProps> = ({
  openedMarker,
  destinationName,
  destinationOptions,
  canEdit,
  setContent,
  createDestination,
  openDestination,
  setSelectedMarkerId,
  setOpenedMarkerId,
}) => {
  if (!openedMarker) return null;
  return (
    <LocationMapMarkerSheet
      title={openedMarker.title}
      note={openedMarker.note}
      icon={openedMarker.icon}
      color={openedMarker.color}
      destinationMapId={openedMarker.destinationMapId}
      destinationUnavailable={
        !!openedMarker.destinationMapId && !destinationName(openedMarker.destinationMapId)
      }
      destinationOptions={destinationOptions}
      canEdit={canEdit}
      onChange={(changes) =>
        setContent((current) => ({
          ...current,
          markers: (current.markers ?? []).map((marker) =>
            marker.id === openedMarker.id ? { ...marker, ...changes } : marker,
          ),
        }))
      }
      onChangeDestination={(destinationMapId) =>
        setContent((current) => ({
          ...current,
          markers: (current.markers ?? []).map((marker) =>
            marker.id === openedMarker.id ? { ...marker, destinationMapId } : marker,
          ),
        }))
      }
      onCreateDestination={() =>
        createDestination(
          { title: openedMarker.title, note: openedMarker.note },
          (destinationMapId) =>
            setContent((current) => ({
              ...current,
              markers: (current.markers ?? []).map((marker) =>
                marker.id === openedMarker.id ? { ...marker, destinationMapId } : marker,
              ),
            })),
        )
      }
      onOpenDestination={() => openDestination(openedMarker.destinationMapId)}
      onClearDestination={() =>
        setContent((current) => ({
          ...current,
          markers: (current.markers ?? []).map((marker) =>
            marker.id === openedMarker.id ? { ...marker, destinationMapId: null } : marker,
          ),
        }))
      }
      onRemove={() => {
        setContent((current) => removeLocationMapPoint(current, openedMarker.id));
        setSelectedMarkerId(null);
        setOpenedMarkerId(null);
      }}
      onClose={() => {
        setOpenedMarkerId(null);
        setSelectedMarkerId(null);
      }}
    />
  );
};

export default LocationMapMarkerSheetSection;
