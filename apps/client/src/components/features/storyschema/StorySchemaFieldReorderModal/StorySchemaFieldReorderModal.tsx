import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import type { StorySchemaFieldSelect } from '../../../../db/schema';
import ReorderModal from '@/src/components/common/modals/ReorderModal/ReorderModal';

interface StorySchemaFieldReorderModalProps {
  isVisible: boolean;
  fields: StorySchemaFieldSelect[];
  onClose: () => void;
  onReorderConfirm: (newOrder: { id: string; order: number }[]) => Promise<void>;
}

export function StorySchemaFieldReorderModal({
  isVisible,
  fields,
  onClose,
  onReorderConfirm,
}: StorySchemaFieldReorderModalProps) {
  const { t } = useTranslation();

  const sortedFields = [...fields].sort((a, b) => a.order - b.order);

  const handleConfirm = useCallback(
    async (reordered: StorySchemaFieldSelect[]) => {
      await onReorderConfirm(reordered.map((field, order) => ({ id: field.id, order })));
    },
    [onReorderConfirm],
  );

  return (
    <ReorderModal<StorySchemaFieldSelect>
      isVisible={isVisible}
      onClose={onClose}
      title={t('reorder_attributes_title')}
      items={sortedFields}
      getId={(field) => field.id}
      getLabel={(field) => field.name}
      onReorderConfirm={handleConfirm}
    />
  );
}
