import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import type { AdminUserInfo, Tier } from '@keres/shared';
import { AdminUserApiService } from '../../api/AdminUserApiService';
import { TierApiService } from '../../api/TierApiService';

export function UsersListPage() {
  const { t, i18n } = useTranslation('admin');
  const [users, setUsers] = useState<AdminUserInfo[]>([]);
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [total, setTotal] = useState(0);
  const [searchInput, setSearchInput] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [showDeleted, setShowDeleted] = useState(false);
  const [page, setPage] = useState(1);
  const [reloadToken, setReloadToken] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const pageSize = 25;

  useEffect(() => {
    TierApiService.list()
      .then(setTiers)
      .catch(() => {
        // Tier names are a nicety; the list still works with raw ids.
      });
  }, []);

  useEffect(() => {
    let ignore = false;
    setLoading(true);
    setError(null);
    AdminUserApiService.list({
      search: appliedSearch || undefined,
      isDeleted: showDeleted || undefined,
      page,
      pageSize,
    })
      .then((res) => {
        if (ignore) return;
        setUsers(res.items);
        setTotal(res.total);
      })
      .catch((err) => {
        if (ignore) return;
        setError(err.message);
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });
    return () => {
      ignore = true;
    };
  }, [page, showDeleted, appliedSearch, reloadToken]);

  const onSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    setAppliedSearch(searchInput.trim());
  };

  const tierName = (tierId: string | null) => {
    if (!tierId) return '-';
    return tiers.find((t) => t.id === tierId)?.name ?? tierId;
  };

  const toggleDelete = async (user: AdminUserInfo) => {
    try {
      if (user.isDeleted) {
        await AdminUserApiService.restore(user.id);
      } else {
        const message = user.isAdmin
          ? t('users.confirmDeleteAdmin', { username: user.username })
          : t('users.confirmDelete', { username: user.username });
        if (!confirm(message)) return;
        await AdminUserApiService.softDelete(user.id);
      }
      setReloadToken((n) => n + 1);
    } catch (err) {
      alert(err instanceof Error ? err.message : t('common.actionFailed'));
    }
  };

  return (
    <div>
      <div className="page-header">
        <h1>{t('users.title')}</h1>
        <Link to="/users/new" className="button">
          {t('users.newUser')}
        </Link>
      </div>

      <form className="toolbar" onSubmit={onSearchSubmit}>
        <label>
          {t('common.search')}
          <input
            placeholder={t('users.searchPlaceholder')}
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            aria-label={t('users.searchAriaLabel')}
          />
        </label>
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={showDeleted}
            onChange={(e) => {
              setShowDeleted(e.target.checked);
              setPage(1);
            }}
          />
          {t('users.showDeleted')}
        </label>
        <button type="submit">{t('common.search')}</button>
      </form>

      {error && <p className="error-text">{error}</p>}
      {loading ? (
        <p className="loading-text">{t('common.loading')}</p>
      ) : (
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>{t('users.columnUsername')}</th>
                <th>{t('users.columnTag')}</th>
                <th>{t('users.columnAdmin')}</th>
                <th>{t('users.columnTier')}</th>
                <th>{t('users.columnCreated')}</th>
                <th>{t('users.columnStatus')}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className={u.isDeleted ? 'row-deleted' : ''}>
                  <td>
                    <Link to={`/users/${u.id}`}>{u.username}</Link>
                  </td>
                  <td>@{u.tag}</td>
                  <td>{u.isAdmin ? t('common.yes') : ''}</td>
                  <td>{tierName(u.tierId)}</td>
                  <td>{new Date(u.createdAt).toLocaleDateString(i18n.language)}</td>
                  <td>
                    <span className={`status-badge${u.isDeleted ? ' deleted' : ''}`}>
                      {u.isDeleted ? t('users.statusDeleted') : t('users.statusActive')}
                    </span>
                  </td>
                  <td>
                    <button
                      type="button"
                      className={u.isDeleted ? undefined : 'button-danger'}
                      onClick={() => void toggleDelete(u)}
                    >
                      {u.isDeleted ? t('common.restore') : t('common.delete')}
                    </button>
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan={7} className="empty-state">
                    {t('users.empty')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <div className="pagination">
        <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
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
          onClick={() => setPage((p) => p + 1)}
        >
          {t('common.next')}
        </button>
      </div>
    </div>
  );
}
