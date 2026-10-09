import CanvasCreateModal, {
  type CanvasCreateModalProps,
} from '@/src/components/features/canvas/CanvasCreateModal';
import React from 'react';
import { useTranslation } from 'react-i18next';

type Props = Omit<CanvasCreateModalProps, 'title' | 'descriptionPlaceholder'> & {
  title?: string;
};

const LocationMapCreateModal: React.FC<Props> = ({ title, ...rest }) => {
  const { t } = useTranslation();
  return (
    <CanvasCreateModal
      {...rest}
      title={title ?? t('location_map_create_title')}
      descriptionPlaceholder={t('title_optional')}
    />
  );
};

export default LocationMapCreateModal;
