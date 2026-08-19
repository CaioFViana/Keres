import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { AdminUserInfo, Tier } from '@keres/shared';
import { AdminUserApiService } from '../../api/AdminUserApiService';
import { TierApiService } from '../../api/TierApiService';

export function UsersListPage() {
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
          ? `Soft-delete admin "${user.username}"? They will lose access until restored.`
          : `Soft-delete user "${user.username}"?`;
        if (!confirm(message)) return;
        await AdminUserApiService.softDelete(user.id);
      }
      setReloadToken((n) => n + 1);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Action failed.');
    }
  };

  return (
    <div>
      <div className="page-header">
        <h1>Users</h1>
        <Link to="/users/new" className="button">
          New user
        </Link>
      </div>

      <form className="toolbar" onSubmit={onSearchSubmit}>
        <label>
          Search
          <input
            placeholder="Username or tag..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            aria-label="Search username or tag"
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
          Show deleted
        </label>
        <button type="submit">Search</button>
      </form>

      {error && <p className="error-text">{error}</p>}
      {loading ? (
        <p className="loading-text">Loading...</p>
      ) : (
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Username</th>
                <th>Tag</th>
                <th>Admin</th>
                <th>Tier</th>
                <th>Created</th>
                <th>Status</th>
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
                  <td>{u.isAdmin ? 'Yes' : ''}</td>
                  <td>{tierName(u.tierId)}</td>
                  <td>{new Date(u.createdAt).toLocaleDateString()}</td>
                  <td>
                    <span className={`status-badge${u.isDeleted ? ' deleted' : ''}`}>
                      {u.isDeleted ? 'Deleted' : 'Active'}
                    </span>
                  </td>
                  <td>
                    <button
                      type="button"
                      className={u.isDeleted ? undefined : 'button-danger'}
                      onClick={() => void toggleDelete(u)}
                    >
                      {u.isDeleted ? 'Restore' : 'Delete'}
                    </button>
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan={7} className="empty-state">
                    No users found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <div className="pagination">
        <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
          Previous
        </button>
        <span>
          Page {page} of {Math.max(1, Math.ceil(total / pageSize))} ({total} total)
        </span>
        <button
          type="button"
          disabled={page * pageSize >= total}
          onClick={() => setPage((p) => p + 1)}
        >
          Next
        </button>
      </div>
    </div>
  );
}
