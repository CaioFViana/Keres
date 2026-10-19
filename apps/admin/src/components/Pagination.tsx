import { useTranslation } from 'react-i18next';

interface PaginationProps {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
}

/** Previous / next with "page x of y": the footer of every paged list in the admin. */
export function Pagination({ page, pageSize, total, onPageChange }: PaginationProps) {
  const { t } = useTranslation('admin');
  return (
    <div className="pagination">
      <button type="button" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
        {t('common.previous')}
      </button>
      <span>
        {t('common.pagination', {
          page,
          pages: Math.max(1, Math.ceil(total / pageSize)),
          total,
        })}
      </span>
      <button
        type="button"
        disabled={page * pageSize >= total}
        onClick={() => onPageChange(page + 1)}
      >
        {t('common.next')}
      </button>
    </div>
  );
}
