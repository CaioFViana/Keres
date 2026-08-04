import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { AdminUserInfo } from '@keres/shared';
import { AdminUserApiService } from '../../api/AdminUserApiService';

export function UsersListPage() {
  const [users, setUsers] = useState<AdminUserInfo[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [showDeleted, setShowDeleted] = useState(false);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pageSize = 25;

  const load = () => {
    setLoading(true);
    setError(null);
    AdminUserApiService.list({ search: search || undefined, isDeleted: showDeleted || undefined, page, pageSize })
      .then((res) => {
        setUsers(res.items);
        setTotal(res.total);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(load, [page, showDeleted]);

  const onSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    load();
  };

  const toggleDelete = async (user: AdminUserInfo) => {
    try {
      if (user.isDeleted) {
        await AdminUserApiService.restore(user.id);
      } else {
        if (!confirm(`Soft-delete user "${user.username}"?`)) return;
        await AdminUserApiService.softDelete(user.id);
      }
      load();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Action failed.');
    }
  };

  return (
    <div>
      <div className="page-header">
        <h1>Users</h1>
        <Link to="/users/new" className="button">New user</Link>
      </div>

      <form className="toolbar" onSubmit={onSearchSubmit}>
        <input placeholder="Search username/tag..." value={search} onChange={(e) => setSearch(e.target.value)} />
        <label className="checkbox-label">
          <input type="checkbox" checked={showDeleted} onChange={(e) => { setShowDeleted(e.target.checked); setPage(1); }} />
          Show deleted
        </label>
        <button type="submit">Search</button>
      </form>

      {error && <p className="error-text">{error}</p>}
      {loading ? <p>Loading...</p> : (
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
                <td><Link to={`/users/${u.id}`}>{u.username}</Link></td>
                <td>@{u.tag}</td>
                <td>{u.isAdmin ? 'Yes' : ''}</td>
                <td>{u.tierId ?? '-'}</td>
                <td>{new Date(u.createdAt).toLocaleDateString()}</td>
                <td>{u.isDeleted ? 'Deleted' : 'Active'}</td>
                <td>
                  <button onClick={() => toggleDelete(u)}>{u.isDeleted ? 'Restore' : 'Delete'}</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div className="pagination">
        <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</button>
        <span>Page {page} of {Math.max(1, Math.ceil(total / pageSize))} ({total} total)</span>
        <button disabled={page * pageSize >= total} onClick={() => setPage((p) => p + 1)}>Next</button>
      </div>
    </div>
  );
}
