import type { Ionicons } from '@expo/vector-icons';
import type { StorySchemaEntityType } from '@keres/shared';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useEntityPickerOptions } from '@/src/hooks/useEntityPickerOptions';
import { ENTITY_TYPE_ICONS } from '@/src/utils/entityTypeIcons';
import type { MultiSelectGroup } from '../MultiSelectPill/MultiSelectPill';
import MultiSelectPill from '../MultiSelectPill/MultiSelectPill';

interface EntityPickerInputProps {
  storyId: string;
  entityType: StorySchemaEntityType;
  value: string | null;
  onChange: (value: string | null) => void;
  placeholder?: string;
}

/** A one-group, single-selection entity picker that stores the raw entity ULID. */
const EntityPickerInput: React.FC<EntityPickerInputProps> = ({
  storyId,
  entityType,
  value,
  onChange,
  placeholder,
}) => {
  const { t } = useTranslation();
  const { options, loading } = useEntityPickerOptions(storyId, entityType);

  const groups = useMemo<MultiSelectGroup[]>(
    () => [
      {
        key: entityType,
        label: t(`${entityType.toLowerCase()}s`),
        icon: ENTITY_TYPE_ICONS[entityType] as keyof typeof Ionicons.glyphMap,
        options: options.map((option) => ({
          label: option.name || t('unnamed'),
          value: option.id,
        })),
      },
    ],
    [entityType, options, t],
  );

  return (
    <MultiSelectPill
      groups={groups}
      selectedValues={value ? [value] : []}
      onSelectionChange={(selected) => onChange(selected[0] ?? null)}
      singleSelect
      placeholder={placeholder || t('attribute_entity_select_placeholder')}
      searchPlaceholder={t('attribute_entity_search_placeholder')}
      noOptionsText={loading ? t('loading') : t('attribute_entity_none')}
    />
  );
};

export default EntityPickerInput;
