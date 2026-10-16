import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import SelectModal from '@/src/components/common/modals/SelectModal/SelectModal';
import type { LocationSelect } from '@/src/db/schema';

interface LocationPickerModalProps {
  isVisible: boolean;
  onClose: () => void;
  onSelect: (locationId: string) => void;
  title: string;
  candidates: LocationSelect[];
}

/**
 * A generic Location picker, reused by the 3 kinds of action in LocationRelationManager (set a parent,
 * add a child, add a connection) and by the location map - only the candidate list differs, already
 * filtered by the caller (self-reference/cycle/already-connected excluded before reaching here).
 *
 * It is the shared `SelectModal` with the locations' wording: opened from a button or a menu rather than
 * from a field, and searchable like every other selector.
 */
const LocationPickerModal: React.FC<LocationPickerModalProps> = ({
  isVisible,
  onClose,
  onSelect,
  title,
  candidates,
}) => {
  const { t } = useTranslation();

  const source = useMemo(
    () => ({
      options: [...candidates]
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((location) => ({ label: location.name, value: location.id })),
    }),
    [candidates],
  );

  return (
    <SelectModal
      visible={isVisible}
      onClose={onClose}
      source={source}
      selectedValues={[]}
      onSelectionChange={(values) => {
        if (values[0]) onSelect(values[0]);
      }}
      title={title}
      singleSelect
      noOptionsText={t('no_locations_available')}
    />
  );
};

export default LocationPickerModal;
