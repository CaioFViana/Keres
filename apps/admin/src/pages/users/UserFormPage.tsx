import { useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { UsersListPage } from './UsersListPage';
import { UserEditModal } from './UserEditModal';

/**
 * Thin route wrapper: the list stays mounted behind, and creating or editing
 * an account is a dialog over it. Closing the dialog returns to `/users`,
 * which remounts the list with fresh data.
 */
export function UserFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const close = useCallback(() => navigate('/users'), [navigate]);

  return (
    <>
      <UsersListPage />
      <UserEditModal key={id ?? 'new'} userId={id ?? null} onClose={close} />
    </>
  );
}
