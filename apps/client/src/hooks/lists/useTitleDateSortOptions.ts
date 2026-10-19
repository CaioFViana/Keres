import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

/** The sort choices of a list of titled entities: by title, by creation and by the last change. */
export function useTitleDateSortOptions() {
  const { t } = useTranslation();
  return useMemo(
    () => [
      { label: t('sort_by_title'), value: 'title' },
      { label: t('sort_by_created_at'), value: 'createdAt' },
      { label: t('sort_by_updated_at'), value: 'updatedAt' },
    ],
    [t],
  );
}
