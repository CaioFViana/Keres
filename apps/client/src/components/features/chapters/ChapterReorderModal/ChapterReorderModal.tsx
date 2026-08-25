import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import type { ChapterSelect } from '../../../../db/schema';
import { buildReorderItems } from '@/src/utils/reorderIndexes';
import ReorderModal from '@/src/components/common/modals/ReorderModal/ReorderModal';

interface ChapterReorderModalProps {
  isVisible: boolean;
  onClose: () => void;
  chapters: ChapterSelect[];
  onReorderConfirm: (newOrder: { id: string; newIndex: number }[]) => Promise<void>;
}

const ChapterReorderModal: React.FC<ChapterReorderModalProps> = ({
  isVisible,
  onClose,
  chapters,
  onReorderConfirm,
}) => {
  const { t } = useTranslation();

  const sortedChapters = [...chapters].sort((a, b) => a.index - b.index);

  const handleConfirm = useCallback(
    async (reordered: ChapterSelect[]) => {
      await onReorderConfirm(buildReorderItems(reordered, (chapter) => chapter.id));
    },
    [onReorderConfirm],
  );

  return (
    <ReorderModal<ChapterSelect>
      isVisible={isVisible}
      onClose={onClose}
      title={t('reorder_chapters_title')}
      items={sortedChapters}
      getId={(chapter) => chapter.id}
      getLabel={(chapter) => chapter.name}
      onReorderConfirm={handleConfirm}
    />
  );
};

export default ChapterReorderModal;
