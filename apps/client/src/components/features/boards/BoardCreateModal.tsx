import CanvasCreateModal, {
  type CanvasCreateModalProps,
} from '@/src/components/features/canvas/CanvasCreateModal';
import React from 'react';
import { useTranslation } from 'react-i18next';

type Props = Omit<CanvasCreateModalProps, 'title' | 'descriptionPlaceholder'> & {
  title?: string;
};

const BoardCreateModal: React.FC<Props> = ({ title, ...rest }) => {
  const { t } = useTranslation();
  return (
    <CanvasCreateModal
      {...rest}
      title={title ?? t('board_create_title')}
      descriptionPlaceholder={t('board_description_placeholder')}
    />
  );
};

export default BoardCreateModal;
